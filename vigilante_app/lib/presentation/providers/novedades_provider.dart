import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/datasources/supabase_datasource.dart';
import '../../data/repositories/acceso_repository_impl.dart';

final novedadesProvider = StateNotifierProvider<NovedadesNotifier, NovedadesState>((ref) {
  final datasource = SupabaseDatasource();
  final repo = AccesoRepositoryImpl(datasource);
  return NovedadesNotifier(repo);
});

class NovedadesState {
  final bool isLoading;
  final String? error;
  final List<Map<String, dynamic>> lista;

  const NovedadesState({this.isLoading = false, this.error, this.lista = const []});

  NovedadesState copyWith({bool? isLoading, String? error, List<Map<String, dynamic>>? lista}) =>
      NovedadesState(
        isLoading: isLoading ?? this.isLoading,
        error: error,
        lista: lista ?? this.lista,
      );
}

class NovedadesNotifier extends StateNotifier<NovedadesState> {
  final AccesoRepositoryImpl _repo;

  NovedadesNotifier(this._repo) : super(const NovedadesState());

  Future<void> cargar(String institucionId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final list = await _repo.getNovedades(institucionId);
      state = state.copyWith(isLoading: false, lista: list);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> registrar({
    required String institucionId,
    required String vigilanteId,
    String? turnoId,
    required String titulo,
    required String descripcion,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repo.insertNovedad({
        'institucion_id': institucionId,
        'vigilante_id': vigilanteId,
        'creador_id': vigilanteId,
        if (turnoId != null) 'turno_id': turnoId,
        'titulo': titulo,
        'descripcion': descripcion,
      });
      state = state.copyWith(isLoading: false);
      await cargar(institucionId);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}
