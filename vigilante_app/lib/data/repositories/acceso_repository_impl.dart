import '../../domain/entities/acceso.dart';
import '../../domain/entities/modulo_config.dart';
import '../../domain/repositories/i_acceso_repository.dart';
import '../datasources/supabase_datasource.dart';
import '../models/bitacora_acceso_model.dart';
import '../models/modulo_config_model.dart';

class AccesoRepositoryImpl implements IAccesoRepository {
  final SupabaseDatasource _datasource;

  AccesoRepositoryImpl(this._datasource);

  Future<List<ModuloConfig>> getModulosActivos(String institucionId) async {
    final data = await _datasource.getModulosActivos(institucionId);
    return data.map((json) => ModuloConfigModel.fromJson(json).toEntity()).toList();
  }

  Future<Acceso> registrarAcceso({
    required String institucionId,
    required String vigilanteId,
    required String nombre,
    required String documento,
    String? tipoDocumento,
    required String tipoEntrada,
    Map<String, dynamic>? datosJsonb,
    String? observaciones,
  }) async {
    final model = BitacoraAccesoModel(
      id: '',
      institucionId: institucionId,
      vigilanteId: vigilanteId,
      nombre: nombre,
      documento: documento,
      tipoDocumento: tipoDocumento,
      tipoEntrada: tipoEntrada,
      datosJsonb: datosJsonb,
      observaciones: observaciones,
      createdAt: DateTime.now(),
    );

    final inserted = await _datasource.insertAcceso(model.toJson());
    return BitacoraAccesoModel.fromJson(inserted).toEntity();
  }

  Future<List<Map<String, dynamic>>> buscarHistorial(String query, String institucionId) async {
    return _datasource.buscarHistorial(query, institucionId);
  }

  Future<Map<String, dynamic>?> getTurnoActivo(String vigilanteId) async {
    return _datasource.getTurnoActivo(vigilanteId);
  }

  Future<Map<String, dynamic>> iniciarTurno(Map<String, dynamic> data) async {
    return _datasource.iniciarTurno(data);
  }

  Future<void> finalizarTurno(String id, {String? motivo}) async {
    return _datasource.finalizarTurno(id, motivo: motivo);
  }

  Future<List<Map<String, dynamic>>> getNovedades(String institucionId) async {
    return _datasource.getNovedades(institucionId);
  }

  Future<void> insertNovedad(Map<String, dynamic> data) async {
    return _datasource.insertNovedad(data);
  }

  Future<List<Map<String, dynamic>>> getMensajes(String institucionId, String? vigilanteId) async {
    return _datasource.getMensajes(institucionId, vigilanteId);
  }

  Future<void> insertMensaje(Map<String, dynamic> data) async {
    return _datasource.insertMensaje(data);
  }

  Future<Map<String, dynamic>?> getUltimoIngreso(String documento, String institucionId) async {
    return _datasource.getUltimoIngreso(documento, institucionId);
  }

  Future<Map<String, dynamic>?> validarCodigoAutorizacion(String codigo, String institucionId) async {
    return _datasource.validarCodigoAutorizacion(codigo, institucionId);
  }

  Future<void> marcarCodigoUsado(String authId) async {
    return _datasource.marcarCodigoUsado(authId);
  }
}
