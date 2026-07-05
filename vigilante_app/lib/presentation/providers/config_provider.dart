import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/modulo_config.dart';
import '../../data/datasources/supabase_datasource.dart';
import '../../data/repositories/acceso_repository_impl.dart';

final configProvider = FutureProvider.autoDispose.family<List<ModuloConfig>, String>((ref, institucionId) async {
  final datasource = SupabaseDatasource();
  final repo = AccesoRepositoryImpl(datasource);
  return repo.getModulosActivos(institucionId);
});
