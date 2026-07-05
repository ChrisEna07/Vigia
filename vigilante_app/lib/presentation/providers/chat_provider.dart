import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../data/datasources/supabase_datasource.dart';
import '../../data/repositories/acceso_repository_impl.dart';

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  final datasource = SupabaseDatasource();
  final repo = AccesoRepositoryImpl(datasource);
  return ChatNotifier(repo, datasource);
});

class ChatState {
  final bool isLoading;
  final String? error;
  final List<Map<String, dynamic>> mensajes;

  const ChatState({this.isLoading = false, this.error, this.mensajes = const []});

  ChatState copyWith({bool? isLoading, String? error, List<Map<String, dynamic>>? mensajes}) =>
      ChatState(
        isLoading: isLoading ?? this.isLoading,
        error: error,
        mensajes: mensajes ?? this.mensajes,
      );
}

class ChatNotifier extends StateNotifier<ChatState> {
  final AccesoRepositoryImpl _repo;
  final SupabaseDatasource _datasource;
  RealtimeChannel? _channel;
  Timer? _timer;

  ChatNotifier(this._repo, this._datasource) : super(const ChatState());

  Future<void> iniciar(String institucionId, String vigilanteId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      // Mark admin messages as read
      try {
        await Supabase.instance.client
            .from('mensajes')
            .update({'leido': true})
            .eq('institucion_id', institucionId)
            .eq('vigilante_id', vigilanteId)
            .neq('remitente_id', vigilanteId)
            .eq('leido', false);
      } catch (err) {
        print('>>> CHAT DEBUG - Error marking initial messages as read: $err');
      }

      print('>>> CHAT DEBUG - INICIAR: institucionId="$institucionId", vigilanteId="$vigilanteId"');
      final list = await _repo.getMensajes(institucionId, vigilanteId);
      print('>>> CHAT DEBUG - FETCHED MESSAGES COUNT: ${list.length}');
      if (!mounted) return;
      state = state.copyWith(isLoading: false, mensajes: list.reversed.toList());

      // Subscribe in real-time
      _channel = _datasource.suscribirMensajes(institucionId, vigilanteId, (newRecord) {
        print('>>> CHAT DEBUG - REALTIME NEW RECORD: ${newRecord["id"]}');
        if (!mounted) return;
        state = state.copyWith(
          mensajes: [...state.mensajes, newRecord],
        );

        // Mark as read immediately on realtime receive
        if (newRecord['remitente_id'] != vigilanteId) {
          Supabase.instance.client
              .from('mensajes')
              .update({'leido': true})
              .eq('id', newRecord['id'])
              .then((_) => print('>>> Chat marked as read in real-time'))
              .catchError((err) => print('>>> Error marking read in real-time: $err'));
        }
      });

      // Polling fallback
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 4), (timer) async {
        if (!mounted) return;
        try {
          final list = await _repo.getMensajes(institucionId, vigilanteId);
          if (!mounted) return;
          if (list.length != state.mensajes.length) {
            state = state.copyWith(mensajes: list.reversed.toList());
          }
        } catch (_) {}
      });
    } catch (e) {
      print('>>> CHAT DEBUG - ERROR IN INICIAR: $e');
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> enviar({
    required String institucionId,
    required String remitenteId,
    required String remitenteNombre,
    required String contenido,
    required String vigilanteId,
  }) async {
    try {
      await _repo.insertMensaje({
        'institucion_id': institucionId,
        'remitente_id': remitenteId,
        'remitente_nombre': remitenteNombre,
        'contenido': contenido,
        'vigilante_id': vigilanteId,
      });
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(error: e.toString());
    }
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    _timer?.cancel();
    super.dispose();
  }
}

// Reactive unread count stream provider
final unreadMessagesProvider = StreamProvider.autoDispose.family<int, String>((ref, arg) {
  final parts = arg.split(',');
  final institucionId = parts[0];
  final vigilanteId = parts[1];

  return Supabase.instance.client
      .from('mensajes')
      .stream(primaryKey: ['id'])
      .map((list) {
        return list.where((m) => 
          m['institucion_id'] == institucionId &&
          m['vigilante_id'] == vigilanteId &&
          m['leido'] == false && 
          m['remitente_id'] != vigilanteId
        ).length;
      });
});
