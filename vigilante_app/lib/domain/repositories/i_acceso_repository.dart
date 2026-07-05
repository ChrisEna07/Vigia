import '../entities/acceso.dart';
import '../entities/modulo_config.dart';

abstract class IAccesoRepository {
  Future<List<ModuloConfig>> getModulosActivos(String institucionId);
  Future<Acceso> registrarAcceso({
    required String institucionId,
    required String vigilanteId,
    required String nombre,
    required String documento,
    String? tipoDocumento,
    required String tipoEntrada,
    Map<String, dynamic>? datosJsonb,
    String? observaciones,
  });
  Future<List<Map<String, dynamic>>> buscarHistorial(String query, String institucionId);
  Future<Map<String, dynamic>?> getTurnoActivo(String vigilanteId);
  Future<Map<String, dynamic>> iniciarTurno(Map<String, dynamic> data);
  Future<void> finalizarTurno(String id, {String? motivo});
  Future<List<Map<String, dynamic>>> getNovedades(String institucionId);
  Future<void> insertNovedad(Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getMensajes(String institucionId, String? vigilanteId);
  Future<void> insertMensaje(Map<String, dynamic> data);
  Future<Map<String, dynamic>?> getUltimoIngreso(String documento, String institucionId);
  Future<Map<String, dynamic>?> validarCodigoAutorizacion(String codigo, String institucionId);
  Future<void> marcarCodigoUsado(String authId);
}
