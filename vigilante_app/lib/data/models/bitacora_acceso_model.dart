import '../../domain/entities/acceso.dart';

class BitacoraAccesoModel {
  final String id;
  final String institucionId;
  final String vigilanteId;
  final String nombre;
  final String documento;
  final String? tipoDocumento;
  final String tipoEntrada;
  final Map<String, dynamic>? datosJsonb;
  final String? observaciones;
  final DateTime createdAt;

  const BitacoraAccesoModel({
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

  Map<String, dynamic> toJson() => {
        'institucion_id': institucionId,
        'vigilante_id': vigilanteId,
        'nombre': nombre,
        'documento': documento,
        'tipo_documento': tipoDocumento ?? 'CC',
        'tipo_entrada': tipoEntrada,
        if (datosJsonb != null) 'datos_jsonb': datosJsonb,
        if (observaciones != null) 'observaciones': observaciones,
      };

  factory BitacoraAccesoModel.fromJson(Map<String, dynamic> json) => BitacoraAccesoModel(
        id: json['id'] as String,
        institucionId: json['institucion_id'] as String,
        vigilanteId: json['vigilante_id'] as String,
        nombre: json['nombre'] as String,
        documento: json['documento'] as String,
        tipoDocumento: json['tipo_documento'] as String?,
        tipoEntrada: json['tipo_entrada'] as String,
        datosJsonb: json['datos_jsonb'] as Map<String, dynamic>?,
        observaciones: json['observaciones'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );

  Acceso toEntity() => Acceso(
        id: id,
        institucionId: institucionId,
        vigilanteId: vigilanteId,
        nombre: nombre,
        documento: documento,
        tipoDocumento: tipoDocumento,
        tipoEntrada: tipoEntrada == 'ingreso' ? TipoEntrada.ingreso : TipoEntrada.salida,
        datosJsonb: datosJsonb,
        observaciones: observaciones,
        createdAt: createdAt,
      );
}
