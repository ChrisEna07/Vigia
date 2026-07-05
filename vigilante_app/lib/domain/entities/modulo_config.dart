enum Modulo { vehiculos, portatiles, visitantes }

class ModuloConfig {
  final String id;
  final String institucionId;
  final Modulo modulo;
  final bool activo;
  final Map<String, dynamic>? config;

  const ModuloConfig({
    required this.id,
    required this.institucionId,
    required this.modulo,
    required this.activo,
    this.config,
  });
}
