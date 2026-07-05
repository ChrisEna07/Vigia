import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/acceso.dart';
import '../../data/datasources/supabase_datasource.dart';
import '../../data/repositories/acceso_repository_impl.dart';

final registroProvider = StateNotifierProvider.autoDispose<RegistroNotifier, RegistroState>((ref) {
  final datasource = SupabaseDatasource();
  final repo = AccesoRepositoryImpl(datasource);
  return RegistroNotifier(repo);
});

class RegistroState {
  final bool isLoading;
  final String? error;
  final Acceso? ultimoAcceso;

  const RegistroState({this.isLoading = false, this.error, this.ultimoAcceso});

  RegistroState copyWith({bool? isLoading, String? error, Acceso? ultimoAcceso}) =>
      RegistroState(
        isLoading: isLoading ?? this.isLoading,
        error: error,
        ultimoAcceso: ultimoAcceso ?? this.ultimoAcceso,
      );
}

class RegistroNotifier extends StateNotifier<RegistroState> {
  final AccesoRepositoryImpl _repo;

  RegistroNotifier(this._repo) : super(const RegistroState());

  AccesoRepositoryImpl get repo => _repo;

  Future<void> registrar({
    required String institucionId,
    required String vigilanteId,
    required String nombre,
    required String documento,
    String? tipoDocumento,
    required String tipoEntrada,
    Map<String, dynamic>? datosJsonb,
    String? observaciones,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final acceso = await _repo.registrarAcceso(
        institucionId: institucionId,
        vigilanteId: vigilanteId,
        nombre: nombre,
        documento: documento,
        tipoDocumento: tipoDocumento,
        tipoEntrada: tipoEntrada,
        datosJsonb: datosJsonb,
        observaciones: observaciones,
      );
      state = state.copyWith(isLoading: false, ultimoAcceso: acceso);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}
