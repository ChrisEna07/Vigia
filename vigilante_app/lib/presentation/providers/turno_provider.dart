import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/datasources/supabase_datasource.dart';
import '../../data/repositories/acceso_repository_impl.dart';

final turnoProvider = StateNotifierProvider<TurnoNotifier, TurnoState>((ref) {
  final datasource = SupabaseDatasource();
  final repo = AccesoRepositoryImpl(datasource);
  return TurnoNotifier(repo);
});

class TurnoState {
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? turnoActivo;

  const TurnoState({this.isLoading = false, this.error, this.turnoActivo});

  TurnoState copyWith({bool? isLoading, String? error, Map<String, dynamic>? turnoActivo}) =>
      TurnoState(
        isLoading: isLoading ?? this.isLoading,
        error: error,
        turnoActivo: turnoActivo,
      );
}

class TurnoNotifier extends StateNotifier<TurnoState> {
  final AccesoRepositoryImpl _repo;

  TurnoNotifier(this._repo) : super(const TurnoState());

  Future<void> checkTurnoActivo(String vigilanteId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final active = await _repo.getTurnoActivo(vigilanteId);
      state = state.copyWith(isLoading: false, turnoActivo: active);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> iniciar(String institucionId, String vigilanteId, {String? motivoTarde}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final created = await _repo.iniciarTurno({
        'institucion_id': institucionId,
        'vigilante_id': vigilanteId,
        'inicio_turno': DateTime.now().toIso8601String(),
        if (motivoTarde != null) 'motivo_entrada_tarde': motivoTarde,
      });
      state = state.copyWith(isLoading: false, turnoActivo: created);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> finalizar({String? motivo}) async {
    if (state.turnoActivo == null) return;
    final id = state.turnoActivo!['id'] as String;
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repo.finalizarTurno(id, motivo: motivo);
      state = state.copyWith(isLoading: false, turnoActivo: null);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}
