import 'package:flutter/material.dart';
import '../../domain/entities/acceso.dart';

class AccesoCard extends StatelessWidget {
  final Acceso acceso;

  const AccesoCard({super.key, required this.acceso});

  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final esIngreso = acceso.tipoEntrada == TipoEntrada.ingreso;

    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: esIngreso ? theme.colorScheme.primary.withValues(alpha: 0.15) : theme.colorScheme.error.withValues(alpha: 0.15),
          child: Icon(esIngreso ? Icons.login : Icons.logout, color: esIngreso ? theme.colorScheme.primary : theme.colorScheme.error),
        ),
        title: Text(acceso.nombre, style: theme.textTheme.titleMedium),
        subtitle: Text('Doc: ${acceso.documento}', style: theme.textTheme.bodyMedium),
        trailing: Text(esIngreso ? 'INGRESO' : 'SALIDA', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: esIngreso ? theme.colorScheme.primary : theme.colorScheme.error)),
      ),
    );
  }
}
