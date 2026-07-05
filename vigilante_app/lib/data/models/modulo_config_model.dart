import '../../domain/entities/modulo_config.dart';

class ModuloConfigModel {
  final String id;
  final String institucionId;
  final String modulo;
  final bool activo;
  final Map<String, dynamic>? config;

  const ModuloConfigModel({
    required this.id,
    required this.institucionId,
    required this.modulo,
    required this.activo,
    this.config,
  });

  factory ModuloConfigModel.fromJson(Map<String, dynamic> json) => ModuloConfigModel(
        id: json['id'] as String,
        institucionId: json['institucion_id'] as String,
        modulo: json['modulo'] as String,
        activo: json['activo'] as bool,
        config: json['config'] as Map<String, dynamic>?,
      );

  ModuloConfig toEntity() => ModuloConfig(
        id: id,
        institucionId: institucionId,
        modulo: Modulo.values.firstWhere((m) => m.name == modulo),
        activo: activo,
        config: config,
      );
}
