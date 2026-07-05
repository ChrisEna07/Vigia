import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../core/config/supabase_config.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _obscurePass = true;
  bool _aceptaDatos = false;

  Future<void> _login() async {
    if (_emailCtrl.text.isEmpty || _passCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, ingresa tu correo y contraseña.')),
      );
      return;
    }

    if (!_aceptaDatos) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Debe aceptar los términos de tratamiento de datos (Habeas Data) para continuar.')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      await ref.read(authProvider).signIn(_emailCtrl.text, _passCtrl.text);

      final user = ref.read(authProvider).currentUser;
      if (user != null) {
        final profile = await SupabaseConfig.supabase
            .from('usuarios')
            .select('activo, rol, dias_laborales')
            .eq('id', user.id)
            .single();

        final activo = profile['activo'] as bool? ?? false;
        final rol = profile['rol'] as String? ?? 'vigilante';

        if (!activo) {
          await ref.read(authProvider).signOut();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tu usuario ha sido desactivado por el administrador.')),
            );
          }
          return;
        }

        if (rol == 'vigilante') {
          final List<String> dias = List<String>.from(profile['dias_laborales'] ?? []);
          final nowDevice = DateTime.now();
          final nowCol = nowDevice.toUtc().subtract(const Duration(hours: 5));
          if (!_estaEnHorarioLaboral(dias, nowDevice) && !_estaEnHorarioLaboral(dias, nowCol)) {
            await ref.read(authProvider).signOut();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('No tienes un turno programado o activo en este horario. Contacta a tu administrador.')),
              );
            }
            return;
          }
        }

        // Update Habeas Data acceptance details in the database
        // Wrapped in try/catch - column may not exist on older DB versions
        try {
          await SupabaseConfig.supabase
              .from('usuarios')
              .update({
                'acepta_datos_ley': true,
                'fecha_aceptacion_ley': DateTime.now().toIso8601String(),
              })
              .eq('id', user.id);
        } catch (_) {
          // Column not yet migrated - continue login normally
        }
      }

      if (mounted) context.replace('/registro');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _getDiaDeLaSemana() {
    final now = DateTime.now();
    switch (now.weekday) {
      case 1: return 'lunes';
      case 2: return 'martes';
      case 3: return 'miercoles';
      case 4: return 'jueves';
      case 5: return 'viernes';
      case 6: return 'sabado';
      case 7: return 'domingo';
      default: return '';
    }
  }

  bool _estaEnHorarioLaboral(List<String> diasLaborales, DateTime now) {
    if (diasLaborales.isEmpty) return true; // Default to allow if empty

    final int todayWeekday = now.weekday;
    final int yesterdayWeekday = todayWeekday == 1 ? 7 : todayWeekday - 1;

    final String todayName = _getNombreDia(todayWeekday);
    final String yesterdayName = _getNombreDia(yesterdayWeekday);

    final double nowTime = now.hour + now.minute / 60.0;

    for (final shiftStr in diasLaborales) {
      final parts = shiftStr.split('|');
      if (parts.isEmpty) continue;
      final String dayName = parts[0].toLowerCase();

      String startStr = '06:00';
      String endStr = '18:00';
      if (parts.length > 1) startStr = parts[1];
      if (parts.length > 2) endStr = parts[2];

      final startParts = startStr.split(':');
      final endParts = endStr.split(':');
      if (startParts.length < 2 || endParts.length < 2) continue;

      final double startVal = int.parse(startParts[0]) + int.parse(startParts[1]) / 60.0;
      final double endVal = int.parse(endParts[0]) + int.parse(endParts[1]) / 60.0;

      if (dayName == todayName) {
        if (startVal <= endVal) {
          if (nowTime >= startVal && nowTime <= endVal) {
            return true;
          }
        } else {
          if (nowTime >= startVal || nowTime <= endVal) {
            return true;
          }
        }
      } else if (dayName == yesterdayName) {
        if (startVal > endVal) {
          if (nowTime <= endVal) {
            return true;
          }
        }
      }
    }
    return false;
  }

  String _getNombreDia(int weekday) {
    switch (weekday) {
      case 1: return 'lunes';
      case 2: return 'martes';
      case 3: return 'miercoles';
      case 4: return 'jueves';
      case 5: return 'viernes';
      case 6: return 'sabado';
      case 7: return 'domingo';
      default: return '';
    }
  }

  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('VIGIA', style: theme.textTheme.headlineLarge?.copyWith(letterSpacing: 8)),
              const SizedBox(height: 8),
              Text('Control de Accesos', style: theme.textTheme.bodyMedium),
              const SizedBox(height: 48),
              TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)), keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 16),
              TextField(
                controller: _passCtrl,
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePass ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscurePass = !_obscurePass),
                  ),
                ),
                obscureText: _obscurePass,
              ),
              const SizedBox(height: 24),
              // Habeas Data Checkbox layout
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _aceptaDatos,
                    onChanged: (val) {
                      setState(() => _aceptaDatos = val ?? false);
                    },
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        'Acepto la política de tratamiento de datos personales de acuerdo con la Ley 1581 de 2012 (Habeas Data de Colombia).',
                        style: theme.textTheme.bodySmall?.copyWith(fontSize: 10),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _login,
                child: _loading 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)) 
                  : const Text('Ingresar')
              ),
            ],
          ),
        ),
      ),
    );
  }
}
