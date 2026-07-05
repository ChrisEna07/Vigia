import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_config.dart';
import '../../core/utils/constants.dart';

class SupabaseDatasource {
  final _client = SupabaseConfig.supabase;

  User? get currentUser => _client.auth.currentUser;
  String? get userId => currentUser?.id;

  Future<List<Map<String, dynamic>>> getModulosActivos(String institucionId) async {
    final res = await _client
        .from(Constants.tableModulosConfig)
        .select()
        .eq('institucion_id', institucionId)
        .eq('activo', true);
    return (res as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> insertAcceso(Map<String, dynamic> data) async {
    final res = await _client.from(Constants.tableBitacora).insert(data).select().single();
    return res;
  }

  Future<void> insertVehiculo(Map<String, dynamic> data) async {
    await _client.from(Constants.tableVehiculos).insert(data);
  }

  Future<void> insertEquipo(Map<String, dynamic> data) async {
    await _client.from(Constants.tableEquipos).insert(data);
  }

  RealtimeChannel suscribirAccesos(String institucionId, void Function(Map<String, dynamic>) onInsert) {
    return _client
        .channel('accesos-en-vivo')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: Constants.tableBitacora,
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'institucion_id', value: institucionId),
          callback: (payload) => onInsert(payload.newRecord),
        )
        .subscribe();
  }

  Future<List<Map<String, dynamic>>> buscarHistorial(String query, String institucionId) async {
    final res = await _client
        .from(Constants.tableBitacora)
        .select('nombre, documento, tipo_documento, datos_jsonb, created_at')
        .eq('institucion_id', institucionId)
        .or('documento.ilike.%$query%,nombre.ilike.%$query%')
        .order('created_at', ascending: false)
        .limit(30);

    final List<Map<String, dynamic>> rawList = (res as List).cast<Map<String, dynamic>>();
    final seen = <String>{};
    final List<Map<String, dynamic>> uniqueList = [];
    
    for (var item in rawList) {
      final doc = item['documento']?.toString().toLowerCase().trim() ?? '';
      if (doc.isNotEmpty && !seen.contains(doc)) {
        seen.add(doc);
        uniqueList.add(item);
        if (uniqueList.length >= 5) break;
      }
    }
    return uniqueList;
  }

  // Turnos
  Future<Map<String, dynamic>?> getTurnoActivo(String vigilanteId) async {
    final res = await _client
        .from('turnos')
        .select()
        .eq('vigilante_id', vigilanteId)
        .isFilter('fin_turno', null)
        .maybeSingle();
    return res;
  }

  Future<Map<String, dynamic>> iniciarTurno(Map<String, dynamic> data) async {
    final res = await _client.from('turnos').insert(data).select().single();
    return res;
  }

  Future<void> finalizarTurno(String id, {String? motivo}) async {
    await _client.from('turnos').update({
      'fin_turno': DateTime.now().toIso8601String(),
      if (motivo != null) 'motivo_cierre_anticipado': motivo,
    }).eq('id', id);
  }

  // Novedades
  Future<List<Map<String, dynamic>>> getNovedades(String institucionId) async {
    final res = await _client
        .from('novedades')
        .select('*, usuarios(nombre_completo)')
        .eq('institucion_id', institucionId)
        .order('created_at', ascending: false);
    return (res as List).cast<Map<String, dynamic>>();
  }

  Future<void> insertNovedad(Map<String, dynamic> data) async {
    await _client.from('novedades').insert(data);
  }

  // Mensajes
  Future<List<Map<String, dynamic>>> getMensajes(String institucionId, String? vigilanteId) async {
    var query = _client.from('mensajes').select().eq('institucion_id', institucionId);
    if (vigilanteId != null) {
      query = query.eq('vigilante_id', vigilanteId);
    }
    final res = await query
        .order('created_at', ascending: false)
        .limit(50);
    return (res as List).cast<Map<String, dynamic>>();
  }

  Future<void> insertMensaje(Map<String, dynamic> data) async {
    await _client.from('mensajes').insert(data);
  }

  RealtimeChannel suscribirMensajes(String institucionId, String? vigilanteId, void Function(Map<String, dynamic>) onInsert) {
    return _client
        .channel('chat-mensajes-${vigilanteId ?? "all"}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'mensajes',
          filter: vigilanteId != null
              ? PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'vigilante_id', value: vigilanteId)
              : PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'institucion_id', value: institucionId),
          callback: (payload) => onInsert(payload.newRecord),
        )
        .subscribe();
  }

  // Autorizaciones de Salida y Verificaciones de Entrada
  Future<Map<String, dynamic>?> getUltimoIngreso(String documento, String institucionId) async {
    final res = await _client
        .from('bitacora_accesos')
        .select()
        .eq('institucion_id', institucionId)
        .eq('documento', documento)
        .eq('tipo_entrada', 'ingreso')
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    return res;
  }

  Future<Map<String, dynamic>?> validarCodigoAutorizacion(String codigo, String institucionId) async {
    final res = await _client
        .from('autorizaciones_salida')
        .select()
        .eq('institucion_id', institucionId)
        .eq('codigo_autorizacion', codigo)
        .eq('usada', false)
        .eq('autoriza_salida', true)
        .maybeSingle();
    return res;
  }

  Future<void> marcarCodigoUsado(String authId) async {
    await _client.from('autorizaciones_salida').update({'usada': true}).eq('id', authId);
  }
}
