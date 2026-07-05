enum TipoEntrada { ingreso, salida }

class Acceso {
  final String id;
  final String institucionId;
  final String vigilanteId;
  final String nombre;
  final String documento;
  final String? tipoDocumento;
  final TipoEntrada tipoEntrada;
  final Map<String, dynamic>? datosJsonb;
  final String? observaciones;
  final DateTime createdAt;

  const Acceso({
    required this.id,
    required this.institucionId,
    required this.vigilanteId,
    required this.nombre,
    required this.documento,
    this.tipoDocumento,
    required this.tipoEntrada,
    this.datosJsonb,
    this.observaciones,
    required this.createdAt,
  });

  Acceso copyWith({TipoEntrada? tipoEntrada}) =>
      Acceso(id: id, institucionId: institucionId, vigilanteId: vigilanteId, nombre: nombre, documento: documento, tipoDocumento: tipoDocumento, tipoEntrada: tipoEntrada ?? this.tipoEntrada, datosJsonb: datosJsonb, observaciones: observaciones, createdAt: createdAt);
}
