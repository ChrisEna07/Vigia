import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_config.dart';
import '../../domain/entities/modulo_config.dart';
import '../providers/auth_provider.dart';
import '../providers/config_provider.dart';
import '../providers/registro_provider.dart';
import '../providers/turno_provider.dart';
import '../providers/novedades_provider.dart';
import '../providers/chat_provider.dart';
import '../widgets/campo_dinamico.dart';

class RegistroRapidoScreen extends ConsumerStatefulWidget {
  const RegistroRapidoScreen({super.key});

  ConsumerState<RegistroRapidoScreen> createState() => _RegistroRapidoScreenState();
}

class _RegistroRapidoScreenState extends ConsumerState<RegistroRapidoScreen> {
  // Navigation State
  int _currentIndex = 0;

  // Access registration controllers
  final _nombreCtrl = TextEditingController();
  final _documentoCtrl = TextEditingController();
  final _placaCtrl = TextEditingController();
  final _serialCtrl = TextEditingController();
  final _marcaCtrl = TextEditingController();
  final _obsCtrl = TextEditingController();
  final _codigoAuthCtrl = TextEditingController(); // Special Release Authorization Code
  String _tipoEntrada = 'ingreso';
  String _tipoDocumento = 'CC';

  // Toggle checks for optional fields
  bool _traeVehiculo = false;
  bool _traeEquipo = false;
  String _tipoVehiculo = 'auto'; // 'auto' or 'moto'

  // Autocomplete state
  List<Map<String, dynamic>> _sugerencias = [];
  String? _cachedInstitucionId;
  List<String> _cachedDiasLaborales = [];
  bool _isLoadingAuth = false;
  Timer? _dbTimer;
  bool _dbOnline = true;

  // Novedades controllers
  final _novTituloCtrl = TextEditingController();
  final _novDescCtrl = TextEditingController();

  // Chat controllers
  final _chatMsgCtrl = TextEditingController();
  final _chatScrollCtrl = ScrollController();

  // Support and Accessibility States
  final _soporteTituloCtrl = TextEditingController();
  final _soporteDescCtrl = TextEditingController();
  bool _sendingTicket = false;
  double _fontScale = 1.0;
  bool _highContrastMode = false;
  bool _institucionActiva = true;
  bool _esDemo = false;
  int? _diasRestantesDemo;
  bool _loadingSuscripcion = true;
  bool _reloadingDb = false;
  Map<String, dynamic>? _anuncioActivo;
  RealtimeChannel? _anunciosChannel;

  String get _institucionId {
    if (_cachedInstitucionId != null && _cachedInstitucionId!.isNotEmpty) {
      return _cachedInstitucionId!;
    }
    final meta = SupabaseConfig.supabase.auth.currentUser?.userMetadata;
    return meta?['institucion_id'] as String? ?? '';
  }

  String get _nombreVigilante {
    final meta = SupabaseConfig.supabase.auth.currentUser?.userMetadata;
    return meta?['nombre_completo'] as String? ?? 'Vigilante';
  }

  bool _isSelectingSuggestion = false;

  void _startDbCheck() {
    _dbTimer = Timer.periodic(const Duration(seconds: 10), (timer) async {
      try {
        await SupabaseConfig.supabase.from('instituciones').select('id').limit(1);
        if (mounted && !_dbOnline) {
          setState(() {
            _dbOnline = true;
          });
        }
      } catch (_) {
        if (mounted && _dbOnline) {
          setState(() {
            _dbOnline = false;
          });
        }
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _startDbCheck();
    _documentoCtrl.addListener(_onDocumentoChanged);
    _nombreCtrl.addListener(_onNombreChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final userId = SupabaseConfig.supabase.auth.currentUser?.id;
      if (userId != null) {
        ref.read(turnoProvider.notifier).checkTurnoActivo(userId);
        
        String instId = '';
        try {
          final res = await SupabaseConfig.supabase
              .from('usuarios')
              .select('institucion_id, dias_laborales')
              .eq('id', userId)
              .single();
          instId = res['institucion_id'] as String? ?? '';
          final rawDias = res['dias_laborales'];
          final List<String> dias = rawDias != null ? List<String>.from(rawDias) : [];
          if (mounted) {
            setState(() {
              _cachedInstitucionId = instId;
              _cachedDiasLaborales = dias;
            });
          }
        } catch (_) {
          final meta = SupabaseConfig.supabase.auth.currentUser?.userMetadata;
          instId = meta?['institucion_id'] as String? ?? '';
        }

        if (instId.isNotEmpty) {
          ref.read(novedadesProvider.notifier).cargar(instId);
          ref.read(chatProvider.notifier).iniciar(instId, userId);
          _verificarSuscripcion(instId);
        } else {
          setState(() => _loadingSuscripcion = false);
        }
        _verificarAnuncioActivo();
        _suscribirAnuncios();
      }
    });
  }

  Future<void> _verificarSuscripcion(String instId) async {
    if (instId.isEmpty) return;
    try {
      final res = await SupabaseConfig.supabase
          .from('instituciones')
          .select('activa, estado_suscripcion, en_demo, limite_demo')
          .eq('id', instId)
          .single();
          
      bool activa = (res['activa'] as bool? ?? false) && (res['estado_suscripcion'] as String? ?? '') == 'activa';
      bool enDemo = res['en_demo'] as bool? ?? false;
      int? diasRestantes;
      
      if (enDemo && res['limite_demo'] != null) {
        final limite = DateTime.parse(res['limite_demo'] as String);
        final hoy = DateTime.now();
        final diff = limite.difference(DateTime(hoy.year, hoy.month, hoy.day)).inDays;
        diasRestantes = diff;
        if (diff <= 0) {
          activa = false;
        }
      }
      
      if (mounted) {
        setState(() {
          _institucionActiva = activa;
          _esDemo = enDemo;
          _diasRestantesDemo = diasRestantes;
          _loadingSuscripcion = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingSuscripcion = false;
        });
      }
    }
  }

  void _onDocumentoChanged() {
    if (_isSelectingSuggestion) return;
    _buscarSugerencias(_documentoCtrl.text);
  }

  void _onNombreChanged() {
    if (_isSelectingSuggestion) return;
    _buscarSugerencias(_nombreCtrl.text);
  }

  @override
  void dispose() {
    _dbTimer?.cancel();
    if (_anunciosChannel != null) {
      SupabaseConfig.supabase.removeChannel(_anunciosChannel!);
    }
    _documentoCtrl.removeListener(_onDocumentoChanged);
    _nombreCtrl.removeListener(_onNombreChanged);
    _nombreCtrl.dispose();
    _documentoCtrl.dispose();
    _placaCtrl.dispose();
    _serialCtrl.dispose();
    _marcaCtrl.dispose();
    _obsCtrl.dispose();
    _codigoAuthCtrl.dispose();
    _novTituloCtrl.dispose();
    _novDescCtrl.dispose();
    _chatMsgCtrl.dispose();
    _chatScrollCtrl.dispose();
    super.dispose();
  }

  void _abrirEscaner(TextEditingController controller, {bool esDocumento = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.75,
          color: Colors.black,
          child: Column(
            children: [
              AppBar(
                title: Text(esDocumento ? 'Escaneo de Cédula' : 'Escaneo de Serial'),
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                elevation: 0,
                leading: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              Expanded(
                child: Stack(
                  children: [
                    MobileScanner(
                      onDetect: (capture) {
                        final List<Barcode> barcodes = capture.barcodes;
                        for (final barcode in barcodes) {
                          if (barcode.rawValue != null) {
                            final code = barcode.rawValue!;
                            controller.text = code;
                            Navigator.pop(context);
                            
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Código detectado: $code'),
                                backgroundColor: Colors.green,
                              ),
                            );

                            if (esDocumento) {
                              _buscarSugerencias(code);
                            }
                            break;
                          }
                        }
                      },
                    ),
                    // Centered focus area
                    Center(
                      child: Container(
                        width: 260,
                        height: 200,
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.greenAccent, width: 3),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Center(
                          child: AnimatedContainer(
                            duration: const Duration(seconds: 1),
                            width: 250,
                            height: 2,
                            color: Colors.redAccent,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Column(
                  children: [
                    const Text(
                      'Enfoque el código de barras o QR de la cédula o portátil.',
                      style: TextStyle(color: Colors.white70, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey[900],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        // Generate mock values for tests in emulators
                        final mockCode = esDocumento ? '100200300' : 'SN-LAPTOP-9988';
                        controller.text = mockCode;
                        Navigator.pop(context);
                        
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Simulado: $mockCode'),
                            backgroundColor: Colors.blueAccent,
                          ),
                        );

                        if (esDocumento) {
                          _buscarSugerencias(mockCode);
                        }
                      },
                      icon: const Icon(Icons.developer_mode),
                      label: const Text('Simular Lectura (Emulador)'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _buscarSugerencias(String query) async {
    if (query.length < 3) {
      setState(() => _sugerencias = []);
      return;
    }
    try {
      final res = await ref.read(registroProvider.notifier).repo.buscarHistorial(query, _institucionId);
      setState(() => _sugerencias = res);
    } catch (e) {
      // Ignorar fallas de conexión silenciosas en sugerencias
    }
  }

  Future<void> _verificarAutorizacionSalida() async {
    if (_tipoEntrada != 'salida') return;
    if (_documentoCtrl.text.trim().isEmpty) return;

    setState(() {
      _isLoadingAuth = true;
    });

    try {
      final res = await SupabaseConfig.supabase
          .from('autorizaciones_salida')
          .select()
          .eq('institucion_id', _institucionId)
          .eq('usuario_documento', _documentoCtrl.text.trim())
          .eq('usada', false)
          .eq('autoriza_salida', true)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (res != null) {
        setState(() {
          _traeEquipo = true;
          _serialCtrl.text = res['serial'] ?? '';
          _marcaCtrl.text = res['tipo_objeto'] ?? '';
          _codigoAuthCtrl.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Autorización de salida detectada para: ${res['tipo_objeto']}. Ingresa el código.'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        setState(() {
          _traeEquipo = false;
          _serialCtrl.clear();
          _marcaCtrl.clear();
          _codigoAuthCtrl.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El usuario no tiene autorización para retirar elementos.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error al consultar autorizaciones: $e');
    } finally {
      setState(() {
        _isLoadingAuth = false;
      });
    }
  }

  Future<void> _registrar() async {
    if (_nombreCtrl.text.isEmpty || _documentoCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, ingresa el nombre y número de documento.')),
      );
      return;
    }

    final turnoState = ref.read(turnoProvider);
    if (turnoState.turnoActivo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Error: Debes iniciar tu turno antes de registrar un acceso.'),
          backgroundColor: Colors.orange,
        ),
      );
      setState(() => _currentIndex = 1);
      return;
    }

    final currentUser = SupabaseConfig.supabase.auth.currentUser;
    if (currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error: No hay una sesión activa.')),
      );
      return;
    }

    final dataJsonb = <String, dynamic>{};
    if (_traeVehiculo && _placaCtrl.text.isNotEmpty) {
      dataJsonb['placa'] = _placaCtrl.text;
      dataJsonb['tipo_vehiculo'] = _tipoVehiculo;
    }
    if (_traeEquipo && _serialCtrl.text.isNotEmpty) {
      dataJsonb['serial'] = _serialCtrl.text;
      dataJsonb['marca'] = _marcaCtrl.text;
    }

    // Security Verification: Object release check at SALIDA
    if (_tipoEntrada == 'salida' && _traeEquipo && _serialCtrl.text.isNotEmpty) {
      try {
        final lastEntry = await ref.read(registroProvider.notifier).repo.getUltimoIngreso(_documentoCtrl.text, _institucionId);
        final serialIngreso = lastEntry?['datos_jsonb']?['serial']?.toString().trim();

        // If they did not bring this serial at entry (or brought no item)
        if (serialIngreso == null || serialIngreso.toLowerCase() != _serialCtrl.text.trim().toLowerCase()) {
          if (_codigoAuthCtrl.text.trim().isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Retiro de equipo no registrado al ingreso. Se requiere Código de Autorización.'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 4),
              ),
            );
            return;
          }

          // Validate Code in Database
          final authRecord = await ref.read(registroProvider.notifier).repo.validarCodigoAutorizacion(_codigoAuthCtrl.text.trim(), _institucionId);
          if (authRecord == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Código de autorización inválido, ya usado o inactivo.'),
                backgroundColor: Colors.red,
              ),
            );
            return;
          }

          // Save audit trail metadata inside JSONB log
          dataJsonb['autorizacion_codigo'] = _codigoAuthCtrl.text.trim();
          dataJsonb['autorizado_por'] = authRecord['creador_nombre'];

          // Flag authorization as used
          await ref.read(registroProvider.notifier).repo.marcarCodigoUsado(authRecord['id']);
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al verificar autorización de salida: $e'), backgroundColor: Colors.red),
        );
        return;
      }
    }

    try {
      await ref.read(registroProvider.notifier).registrar(
            institucionId: _institucionId,
            vigilanteId: currentUser.id,
            nombre: _nombreCtrl.text,
            documento: _documentoCtrl.text,
            tipoDocumento: _tipoDocumento,
            tipoEntrada: _tipoEntrada,
            datosJsonb: dataJsonb.isNotEmpty ? dataJsonb : null,
            observaciones: _obsCtrl.text.isNotEmpty ? _obsCtrl.text : null,
          );

      final state = ref.read(registroProvider);
      if (state.error != null) {
        if (mounted) {
          String msg = state.error!;
          if (msg.contains('Exception:')) {
            msg = msg.split('Exception:').last.trim();
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error: $msg'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Registro guardado exitosamente.'),
              backgroundColor: Colors.green,
            ),
          );
          _nombreCtrl.clear();
          _documentoCtrl.clear();
          _placaCtrl.clear();
          _serialCtrl.clear();
          _marcaCtrl.clear();
          _obsCtrl.clear();
          _codigoAuthCtrl.clear();
          setState(() {
            _sugerencias = [];
            _traeVehiculo = false;
            _traeEquipo = false;
            _tipoVehiculo = 'auto';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error inesperado: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // --- Subviews ---

  // 1. Registro
  Widget _buildRegistroTab(ThemeData theme, List<ModuloConfig> modulos, bool isLoading, bool hasTurnoActivo) {
    if (!hasTurnoActivo) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_clock, size: 64, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(
                'Turno Inactivo',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Debes iniciar tu turno en la pestaña "Turno" para poder realizar registros de ingreso o salida.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => setState(() => _currentIndex = 1),
                icon: const Icon(Icons.work),
                label: const Text('Ir a Gestión de Turno'),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildTipoSelector(theme),
          const SizedBox(height: 24),
          CampoDinamico(
            controller: _nombreCtrl,
            label: 'Nombre completo',
            icon: Icons.person_outline,
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 90,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _tipoDocumento,
                  decoration: const InputDecoration(
                    labelText: 'Tipo',
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'CC', child: Text('CC')),
                    DropdownMenuItem(value: 'CE', child: Text('CE')),
                    DropdownMenuItem(value: 'Pasaporte', child: Text('Pasp.')),
                    DropdownMenuItem(value: 'PPT', child: Text('PPT')),
                  ],
                  onChanged: isLoading
                      ? null
                      : (val) {
                          if (val != null) {
                            setState(() {
                              _tipoDocumento = val;
                              _documentoCtrl.clear();
                              _sugerencias = [];
                            });
                          }
                        },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: CampoDinamico(
                        controller: _documentoCtrl,
                        label: 'Número de documento',
                        icon: Icons.perm_identity,
                        keyboardType: _tipoDocumento == 'Pasaporte'
                            ? TextInputType.text
                            : TextInputType.number,
                        inputFormatters: _tipoDocumento == 'Pasaporte'
                            ? [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]'))]
                            : [FilteringTextInputFormatter.digitsOnly],
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      onPressed: () => _abrirEscaner(_documentoCtrl, esDocumento: true),
                      icon: const Icon(Icons.camera_alt),
                      tooltip: 'Escanear Cédula',
                    ),
                  ],
                ),
              ),
            ],
          ),
          // Autocomplete list
          if (_sugerencias.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.only(top: 8),
              constraints: const BoxConstraints(maxHeight: 200),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: theme.colorScheme.outline.withOpacity(0.2)),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _sugerencias.length,
                itemBuilder: (context, index) {
                  final sug = _sugerencias[index];
                  return ListTile(
                    title: Text(sug['nombre'], style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${sug['tipo_documento']} ${sug['documento']}'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () {
                      setState(() {
                        _isSelectingSuggestion = true;
                      });
                      
                      _nombreCtrl.text = sug['nombre'];
                      _documentoCtrl.text = sug['documento'];
                      
                      setState(() {
                        _tipoDocumento = sug['tipo_documento'];
                        
                        final hasPlaca = sug['datos_jsonb']?['placa'] != null;
                        final hasSerial = sug['datos_jsonb']?['serial'] != null;
                        
                        _traeVehiculo = hasPlaca;
                        _traeEquipo = hasSerial;

                        if (hasPlaca) {
                          _placaCtrl.text = sug['datos_jsonb']['placa'];
                          _tipoVehiculo = sug['datos_jsonb']?['tipo_vehiculo'] ?? 'auto';
                        }
                        if (hasSerial) {
                          _serialCtrl.text = sug['datos_jsonb']['serial'];
                          _marcaCtrl.text = sug['datos_jsonb']?['marca'] ?? '';
                        }
                        _sugerencias = [];
                      });
                      
                      Future.delayed(const Duration(milliseconds: 300), () {
                        if (mounted) {
                          setState(() {
                            _isSelectingSuggestion = false;
                          });
                        }
                      });
                    },
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: 12),

          // Dynamic checkboxes for active modules
          if (_moduloActivo(modulos, Modulo.vehiculos)) ...[
            CheckboxListTile(
              title: const Text('¿Trae Vehículo?'),
              value: _traeVehiculo,
              activeColor: theme.colorScheme.primary,
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              onChanged: (val) => setState(() => _traeVehiculo = val ?? false),
            ),
            if (_traeVehiculo) ...[
              Row(
                children: [
                  Expanded(
                    child: CampoDinamico(
                      controller: _placaCtrl,
                      label: 'Placa del vehículo',
                      icon: Icons.directions_car,
                    ),
                  ),
                  const SizedBox(width: 12),
                  ToggleButtons(
                    isSelected: [_tipoVehiculo == 'auto', _tipoVehiculo == 'moto'],
                    onPressed: (index) {
                      setState(() {
                        _tipoVehiculo = index == 0 ? 'auto' : 'moto';
                      });
                    },
                    borderRadius: BorderRadius.circular(12),
                    selectedColor: Colors.black,
                    fillColor: theme.colorScheme.primary,
                    children: const [
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('Auto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('Moto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ]
          ],
          if (_moduloActivo(modulos, Modulo.portatiles)) ...[
            CheckboxListTile(
              title: const Text('¿Trae Portátil o Herramientas?'),
              value: _traeEquipo,
              activeColor: theme.colorScheme.primary,
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              onChanged: _isLoadingAuth ? null : (val) {
                final bool isChecked = val ?? false;
                if (isChecked && _tipoEntrada == 'salida') {
                  if (_documentoCtrl.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Por favor, ingresa primero el documento del usuario.'),
                        backgroundColor: Colors.orange,
                      ),
                    );
                    return;
                  }
                  _verificarAutorizacionSalida();
                } else {
                  setState(() {
                    _traeEquipo = isChecked;
                    if (!isChecked) {
                      _serialCtrl.clear();
                      _marcaCtrl.clear();
                      _codigoAuthCtrl.clear();
                    }
                  });
                }
              },
            ),
            if (_traeEquipo) ...[
              Row(
                children: [
                  Expanded(
                    child: CampoDinamico(controller: _serialCtrl, label: 'Serial del equipo', icon: Icons.qr_code),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    onPressed: () => _abrirEscaner(_serialCtrl, esDocumento: false),
                    icon: const Icon(Icons.camera_alt),
                    tooltip: 'Escanear Serial',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              CampoDinamico(controller: _marcaCtrl, label: 'Marca del equipo', icon: Icons.branding_watermark),
              const SizedBox(height: 16),
            ]
          ],

          // Release Authorization Code Field (Only shown on exit + brings item)
          if (_traeEquipo && _tipoEntrada == 'salida') ...[
            CampoDinamico(
              controller: _codigoAuthCtrl,
              label: 'Código de Autorización de Salida',
              icon: Icons.security,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            ),
            const SizedBox(height: 16),
          ],
          
          CampoDinamico(controller: _obsCtrl, label: 'Observaciones', icon: Icons.notes, maxLines: 2),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: isLoading ? null : _registrar,
            icon: isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                  )
                : const Icon(Icons.login),
            label: Text(isLoading
                ? 'Procesando...'
                : _tipoEntrada == 'ingreso'
                    ? 'Registrar Ingreso'
                    : 'Registrar Salida'),
          ),
        ],
      ),
    );
  }

  // 2. Turnos & Novedades
  Widget _buildTurnosTab(ThemeData theme) {
    final turnoState = ref.watch(turnoProvider);
    final novedadesState = ref.watch(novedadesProvider);
    final currentUser = SupabaseConfig.supabase.auth.currentUser;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            color: theme.colorScheme.surfaceContainer,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(
                    turnoState.turnoActivo != null ? Icons.shield_rounded : Icons.shield_outlined,
                    size: 48,
                    color: turnoState.turnoActivo != null ? theme.colorScheme.primary : theme.colorScheme.outline,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    turnoState.turnoActivo != null ? 'Turno Iniciado' : 'Sin Turno Activo',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  if (turnoState.turnoActivo != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Inicio: ${DateFormat('dd MMM, hh:mm a').format(DateTime.parse(turnoState.turnoActivo!['inicio_turno']))}',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: turnoState.isLoading
                        ? null
                        : () async {
                            if (turnoState.turnoActivo != null) {
                              final anticipado = _esCierreAnticipado(_cachedDiasLaborales);
                              if (anticipado) {
                                _mostrarDialogoMotivoCierre(context);
                              } else {
                                await ref.read(turnoProvider.notifier).finalizar();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Turno finalizado con éxito.')),
                                  );
                                }
                              }
                            } else {
                              final tarde = _esLlegadaTarde(_cachedDiasLaborales);
                              if (tarde) {
                                _mostrarDialogoMotivoLlegadaTarde(context);
                              } else {
                                await ref.read(turnoProvider.notifier).iniciar(_institucionId, currentUser!.id);
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: turnoState.turnoActivo != null ? theme.colorScheme.error : theme.colorScheme.primary,
                      foregroundColor: turnoState.turnoActivo != null ? Colors.white : Colors.black,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    child: turnoState.isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(turnoState.turnoActivo != null ? 'Terminar Turno' : 'Iniciar Turno'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          if (turnoState.turnoActivo != null) ...[
            Text('Registrar Novedad', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            CampoDinamico(controller: _novTituloCtrl, label: 'Título de la Novedad', icon: Icons.title),
            const SizedBox(height: 12),
            CampoDinamico(controller: _novDescCtrl, label: 'Detalle o descripción', icon: Icons.description, maxLines: 3),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: novedadesState.isLoading
                  ? null
                  : () async {
                      if (_novTituloCtrl.text.isEmpty || _novDescCtrl.text.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor completa título y detalle.')));
                        return;
                      }
                      await ref.read(novedadesProvider.notifier).registrar(
                            institucionId: _institucionId,
                            vigilanteId: currentUser!.id,
                            turnoId: turnoState.turnoActivo!['id'],
                            titulo: _novTituloCtrl.text,
                            descripcion: _novDescCtrl.text,
                          );
                      _novTituloCtrl.clear();
                      _novDescCtrl.clear();
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Novedad reportada con éxito.'), backgroundColor: Colors.green));
                    },
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
              child: novedadesState.isLoading
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Enviar Reporte'),
            ),
            const SizedBox(height: 28),
          ],

          Text('Historial de Novedades', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          novedadesState.isLoading && novedadesState.lista.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: novedadesState.lista.length,
                  itemBuilder: (context, index) {
                    final nov = novedadesState.lista[index];
                    final date = DateTime.parse(nov['created_at']);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: ListTile(
                        title: Text(nov['titulo'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text(nov['descripcion']),
                            const SizedBox(height: 6),
                            Text(
                              'Fecha: ${DateFormat('dd/MM/yyyy hh:mm a').format(date)}',
                              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
          if (!novedadesState.isLoading && novedadesState.lista.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Sin novedades registradas hoy.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline))),
            ),
        ],
      ),
    );
  }

  Widget _buildChatTab(ThemeData theme) {
    final chatState = ref.watch(chatProvider);
    final currentUser = SupabaseConfig.supabase.auth.currentUser;

    return Column(
      children: [
        if (chatState.error != null)
          Container(
            color: Colors.redAccent,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            width: double.infinity,
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Error del Chat: ${chatState.error}',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: chatState.isLoading && chatState.mensajes.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  controller: _chatScrollCtrl,
                  padding: const EdgeInsets.all(16),
                  itemCount: chatState.mensajes.length,
                  itemBuilder: (context, index) {
                    final msg = chatState.mensajes[index];
                    final esPropio = msg['remitente_id'] == currentUser?.id;
                    return Align(
                      alignment: esPropio ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: esPropio ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(16),
                            topRight: const Radius.circular(16),
                            bottomLeft: esPropio ? const Radius.circular(16) : Radius.zero,
                            bottomRight: esPropio ? Radius.zero : const Radius.circular(16),
                          ),
                        ),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!esPropio)
                              Text(
                                msg['remitente_nombre'],
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: theme.colorScheme.secondary),
                              ),
                            const SizedBox(height: 3),
                            Text(
                              msg['contenido'],
                              style: TextStyle(color: esPropio ? Colors.black : theme.colorScheme.onSurface),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainer,
            border: Border(top: BorderSide(color: theme.colorScheme.outline.withOpacity(0.1))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatMsgCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Escribe un mensaje...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12),
                  ),
                  onSubmitted: (_) => _enviarMensaje(currentUser),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send),
                color: theme.colorScheme.primary,
                onPressed: () => _enviarMensaje(currentUser),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _enviarMensaje(dynamic currentUser) {
    if (_chatMsgCtrl.text.isEmpty) return;
    ref.read(chatProvider.notifier).enviar(
          institucionId: _institucionId,
          remitenteId: currentUser!.id,
          remitenteNombre: currentUser.userMetadata?['nombre_completo'] ?? 'Vigilante',
          contenido: _chatMsgCtrl.text,
          vigilanteId: currentUser.id,
        );
    _chatMsgCtrl.clear();
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_chatScrollCtrl.hasClients) {
        _chatScrollCtrl.animateTo(_chatScrollCtrl.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  Widget _buildSoporteTab(ThemeData theme) {
    final activeTheme = _highContrastMode 
        ? ThemeData.dark().copyWith(
            scaffoldBackgroundColor: Colors.black,
            colorScheme: const ColorScheme.dark(primary: Colors.yellow, surface: Colors.black),
          )
        : theme;

    return Theme(
      data: activeTheme,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              elevation: _highContrastMode ? 0 : 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: _highContrastMode ? const BorderSide(color: Colors.yellow, width: 2) : BorderSide.none,
              ),
              color: _highContrastMode ? Colors.black : theme.cardColor,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Reportar Falla o Soporte',
                      style: activeTheme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: _highContrastMode ? Colors.yellow : null,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Reporta inconvenientes con la aplicación al Super Administrador.',
                      style: activeTheme.textTheme.bodySmall?.copyWith(
                        color: _highContrastMode ? Colors.white : theme.colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _soporteTituloCtrl,
                      style: TextStyle(color: _highContrastMode ? Colors.white : null),
                      decoration: InputDecoration(
                        labelText: 'Asunto / Título',
                        border: const OutlineInputBorder(),
                        labelStyle: TextStyle(color: _highContrastMode ? Colors.yellow : null),
                        prefixIcon: Icon(Icons.title, color: _highContrastMode ? Colors.yellow : null),
                        focusedBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: _highContrastMode ? Colors.yellow : theme.colorScheme.primary),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _soporteDescCtrl,
                      maxLines: 4,
                      style: TextStyle(color: _highContrastMode ? Colors.white : null),
                      decoration: InputDecoration(
                        labelText: 'Descripción detallada',
                        border: const OutlineInputBorder(),
                        labelStyle: TextStyle(color: _highContrastMode ? Colors.yellow : null),
                        alignLabelWithHint: true,
                        focusedBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: _highContrastMode ? Colors.yellow : theme.colorScheme.primary),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _highContrastMode ? Colors.yellow : null,
                        foregroundColor: _highContrastMode ? Colors.black : null,
                      ),
                      onPressed: _sendingTicket ? null : _crearTicketSoporte,
                      icon: _sendingTicket 
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send),
                      label: const Text('Enviar Reporte'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _crearTicketSoporte() async {
    final titulo = _soporteTituloCtrl.text.trim();
    final desc = _soporteDescCtrl.text.trim();
    if (titulo.isEmpty || desc.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor complete todos los campos.')),
      );
      return;
    }
    setState(() => _sendingTicket = true);
    try {
      final userId = SupabaseConfig.supabase.auth.currentUser?.id;
      await SupabaseConfig.supabase.from('soporte_tickets').insert({
        'institucion_id': _institucionId,
        'usuario_id': userId,
        'usuario_nombre': _nombreVigilante,
        'titulo': titulo,
        'descripcion': desc,
        'estado': 'abierto',
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reporte comercial/técnico enviado con éxito.')),
        );
        _soporteTituloCtrl.clear();
        _soporteDescCtrl.clear();
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al reportar soporte: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _sendingTicket = false);
    }
  }

  Widget _buildConfiguracionTab(ThemeData theme) {
    final activeTheme = _highContrastMode 
        ? ThemeData.dark().copyWith(
            scaffoldBackgroundColor: Colors.black,
            colorScheme: const ColorScheme.dark(primary: Colors.yellow, surface: Colors.black),
          )
        : theme;

    return Theme(
      data: activeTheme,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              elevation: _highContrastMode ? 0 : 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: _highContrastMode ? const BorderSide(color: Colors.yellow, width: 2) : BorderSide.none,
              ),
              color: _highContrastMode ? Colors.black : theme.cardColor,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Opciones de Accesibilidad',
                      style: activeTheme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: _highContrastMode ? Colors.yellow : null,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Tamaño de Texto',
                              style: activeTheme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'Ajusta el zoom de la letra',
                              style: activeTheme.textTheme.bodySmall?.copyWith(
                                color: _highContrastMode ? Colors.white : theme.colorScheme.outline,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove),
                              color: _highContrastMode ? Colors.yellow : null,
                              onPressed: () => setState(() => _fontScale = (_fontScale - 0.1).clamp(0.8, 1.3)),
                            ),
                            Text(
                              '${(_fontScale * 100).toInt()}%',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _highContrastMode ? Colors.yellow : null,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add),
                              color: _highContrastMode ? Colors.yellow : null,
                              onPressed: () => setState(() => _fontScale = (_fontScale + 0.1).clamp(0.8, 1.3)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    SwitchListTile(
                      activeColor: _highContrastMode ? Colors.yellow : theme.colorScheme.primary,
                      title: Text(
                        'Alto Contraste',
                        style: activeTheme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        'Esquema de colores de alta legibilidad',
                        style: activeTheme.textTheme.bodySmall?.copyWith(
                          color: _highContrastMode ? Colors.white : theme.colorScheme.outline,
                        ),
                      ),
                      value: _highContrastMode,
                      onChanged: (val) => setState(() => _highContrastMode = val),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              elevation: _highContrastMode ? 0 : 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: _highContrastMode ? const BorderSide(color: Colors.yellow, width: 2) : BorderSide.none,
              ),
              color: _highContrastMode ? Colors.black : theme.cardColor,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Base de Datos',
                      style: activeTheme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: _highContrastMode ? Colors.yellow : null,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sincroniza forzadamente los módulos, turnos y novedades de red.',
                      style: activeTheme.textTheme.bodySmall?.copyWith(
                        color: _highContrastMode ? Colors.white : theme.colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _highContrastMode ? Colors.yellow : null,
                        foregroundColor: _highContrastMode ? Colors.black : null,
                      ),
                      onPressed: _reloadingDb ? null : _recargarBaseDatos,
                      icon: _reloadingDb 
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.refresh),
                      label: const Text('Sincronizar y Recargar'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _recargarBaseDatos() async {
    setState(() => _reloadingDb = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    ref.invalidate(configProvider(_institucionId));
    final userId = SupabaseConfig.supabase.auth.currentUser?.id;
    if (userId != null) {
      ref.read(turnoProvider.notifier).checkTurnoActivo(userId);
    }
    setState(() => _reloadingDb = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Base de datos móvil sincronizada correctamente.')),
      );
    }
  }

  // --- End Subviews ---

  Widget _buildLockScreen(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.block, size: 80, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(
              'Servicio Suspendido',
              style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _esDemo 
                ? 'El periodo de prueba (Demo de 20 días) ha expirado para esta institución.' 
                : 'La suscripción de este cliente ha vencido o está inactiva.',
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Text(
              'Comuníquese con el administrador de su empresa o solicite asistencia técnica en la pestaña de Soporte a continuación.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget build(BuildContext context) {
    if (_loadingSuscripcion) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final theme = Theme.of(context);
    final activeTheme = _highContrastMode 
        ? ThemeData.dark().copyWith(
            scaffoldBackgroundColor: Colors.black,
            colorScheme: const ColorScheme.dark(
              primary: Colors.yellow, 
              surface: Colors.black, 
              onSurface: Colors.white,
              surfaceContainerHighest: Colors.yellow,
            ),
          )
        : theme;

    final configAsync = ref.watch(configProvider(_institucionId));
    final registroState = ref.watch(registroProvider);
    final turnoState = ref.watch(turnoProvider);
    final isLoading = registroState.isLoading;
    final hasTurnoActivo = turnoState.turnoActivo != null;

    final userId = SupabaseConfig.supabase.auth.currentUser?.id ?? '';
    final unreadCountAsync = ref.watch(unreadMessagesProvider('$_institucionId,$userId'));
    final unreadCount = unreadCountAsync.value ?? 0;

    final isBlocked = !_institucionActiva && _currentIndex != 3;

    return Theme(
      data: activeTheme,
      child: MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaleFactor: _fontScale),
        child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _currentIndex == 0
                    ? 'Registro Rápido'
                    : _currentIndex == 1
                        ? 'Turno y Novedades'
                        : _currentIndex == 2
                            ? 'Chat del Turno'
                            : _currentIndex == 3
                                ? 'Soporte Técnico'
                                : 'Ajustes y Accesibilidad',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Text(
                    _nombreVigilante,
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hasTurnoActivo ? Colors.green : Colors.red,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    hasTurnoActivo ? 'Turno activo' : 'Turno inactivo',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: hasTurnoActivo ? Colors.green : Colors.red,
                    ),
                  ),
                  if (_esDemo && _diasRestantesDemo != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.amber.withOpacity(0.3)),
                      ),
                      child: Text(
                        'Demo: $_diasRestantesDemo días',
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _dbOnline ? Colors.green : Colors.red,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _dbOnline ? 'Online' : 'Offline',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: _dbOnline ? Colors.green : Colors.red,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () {
                final hasTurnoActivo = ref.read(turnoProvider).turnoActivo != null;
                if (hasTurnoActivo) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Debes terminar tu turno antes de cerrar sesión para mantener el control de cierre.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                } else {
                  _mostrarConfirmacionLogout(context);
                }
              },
            ),
          ],
        ),
        body: isBlocked
            ? _buildLockScreen(theme)
            : Column(
                children: [
                  if (_anuncioActivo != null) _buildBannerAnuncio(theme),
                  Expanded(
                    child: configAsync.when(
                      error: (e, _) => Center(child: Text('Error al cargar configuración', style: theme.textTheme.bodyMedium)),
                      loading: () => const Center(child: CircularProgressIndicator()),
                      data: (modulos) {
                        if (_currentIndex == 0) {
                          return _buildRegistroTab(theme, modulos, isLoading, hasTurnoActivo);
                        } else if (_currentIndex == 1) {
                          return _buildTurnosTab(theme);
                        } else if (_currentIndex == 2) {
                          return _buildChatTab(theme);
                        } else if (_currentIndex == 3) {
                          return _buildSoporteTab(theme);
                        } else {
                          return _buildConfiguracionTab(theme);
                        }
                      },
                    ),
                  ),
                ],
              ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _currentIndex,
          type: BottomNavigationBarType.fixed,
          onTap: (index) {
            setState(() => _currentIndex = index);
            if (index == 2) {
              final userId = SupabaseConfig.supabase.auth.currentUser?.id;
              if (userId != null && _institucionId.isNotEmpty) {
                ref.read(chatProvider.notifier).iniciar(_institucionId, userId);
              }
              Future.delayed(const Duration(milliseconds: 100), () {
                if (_chatScrollCtrl.hasClients) {
                  _chatScrollCtrl.jumpTo(_chatScrollCtrl.position.maxScrollExtent);
                }
              });
            }
          },
          items: [
            const BottomNavigationBarItem(icon: Icon(Icons.edit_document), label: 'Registro'),
            const BottomNavigationBarItem(icon: Icon(Icons.work), label: 'Turno'),
            BottomNavigationBarItem(
              icon: unreadCount > 0 
                ? const Badge(
                    backgroundColor: Colors.red,
                    child: Icon(Icons.chat),
                  )
                : const Icon(Icons.chat),
              label: 'Chat',
            ),
            const BottomNavigationBarItem(icon: Icon(Icons.support_agent), label: 'Soporte'),
            const BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Ajustes'),
          ],
        ),
      ),
    ),
  );
}

  bool _moduloActivo(List<ModuloConfig> modulos, Modulo modulo) {
    return modulos.any((m) => m.modulo == modulo && m.activo);
  }

  Widget _buildTipoSelector(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _tipoEntrada = 'ingreso'),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: _tipoEntrada == 'ingreso' ? theme.colorScheme.primary : theme.colorScheme.surface,
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
                border: Border.all(color: theme.colorScheme.primary.withOpacity(0.3)),
              ),
              child: Text('INGRESO', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600, color: _tipoEntrada == 'ingreso' ? Colors.black : theme.colorScheme.primary)),
            ),
          ),
        ),
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _tipoEntrada = 'salida'),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: _tipoEntrada == 'salida' ? theme.colorScheme.error : theme.colorScheme.surface,
                borderRadius: const BorderRadius.horizontal(right: Radius.circular(12)),
                border: Border.all(color: theme.colorScheme.error.withOpacity(0.3)),
              ),
              child: Text('SALIDA', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600, color: _tipoEntrada == 'salida' ? Colors.white : theme.colorScheme.error)),
            ),
          ),
        ),
      ],
    );
  }

  bool _esCierreAnticipado(List<String> diasLaborales) {
    if (diasLaborales.isEmpty) return false;

    final nowDevice = DateTime.now();
    final nowCol = nowDevice.toUtc().subtract(const Duration(hours: 5));

    return _verificarEsCierreAnticipadoParaHora(diasLaborales, nowDevice) ||
           _verificarEsCierreAnticipadoParaHora(diasLaborales, nowCol);
  }

  bool _verificarEsCierreAnticipadoParaHora(List<String> diasLaborales, DateTime now) {
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
          if (nowTime < endVal && nowTime >= startVal) {
            return true;
          }
        } else {
          if (nowTime > startVal || nowTime < endVal) {
            return true;
          }
        }
      } else if (dayName == yesterdayName) {
        if (startVal > endVal) {
          if (nowTime < endVal) {
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

  void _mostrarDialogoMotivoCierre(BuildContext context) {
    final controller = TextEditingController();
    final theme = Theme.of(context);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        title: Text(
          'Justificación de Cierre Anticipado',
          style: TextStyle(color: theme.colorScheme.primary, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Estás finalizando tu turno antes del horario asignado. Por favor ingresa el motivo del cierre anticipado:',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Ej. Cambio de guardia autorizado por supervisor...',
                hintStyle: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.4)),
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancelar', style: TextStyle(color: theme.colorScheme.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.black,
            ),
            onPressed: () async {
              final text = controller.text.trim();
              if (text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Por favor, ingresa una justificación.')),
                );
                return;
              }
              Navigator.pop(ctx);
              await ref.read(turnoProvider.notifier).finalizar(motivo: text);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Turno finalizado con éxito.')),
                );
              }
            },
            child: const Text('Guardar y Terminar', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  bool _esLlegadaTarde(List<String> diasLaborales) {
    if (diasLaborales.isEmpty) return false;

    final nowDevice = DateTime.now();
    final nowCol = nowDevice.toUtc().subtract(const Duration(hours: 5));

    return _verificarEsLlegadaTardeParaHora(diasLaborales, nowDevice) ||
           _verificarEsLlegadaTardeParaHora(diasLaborales, nowCol);
  }

  bool _verificarEsLlegadaTardeParaHora(List<String> diasLaborales, DateTime now) {
    final int todayWeekday = now.weekday;
    final String todayName = _getNombreDia(todayWeekday);

    final double nowTime = now.hour + now.minute / 60.0;

    for (final shiftStr in diasLaborales) {
      final parts = shiftStr.split('|');
      if (parts.isEmpty) continue;
      final String dayName = parts[0].toLowerCase();
      if (dayName != todayName) continue;

      String startStr = '06:00';
      String endStr = '18:00';
      if (parts.length > 1) startStr = parts[1];
      if (parts.length > 2) endStr = parts[2];

      final startParts = startStr.split(':');
      final endParts = endStr.split(':');
      if (startParts.length < 2 || endParts.length < 2) continue;

      final double startVal = int.parse(startParts[0]) + int.parse(startParts[1]) / 60.0;
      final double endVal = int.parse(endParts[0]) + int.parse(endParts[1]) / 60.0;

      // Late check-in condition: current time is past startVal + 0.5 (30 minutes)
      // and before the shift ends (endVal)
      final double lateThreshold = startVal + 0.5;

      if (startVal <= endVal) {
        if (nowTime > lateThreshold && nowTime < endVal) {
          return true;
        }
      } else {
        if (nowTime > lateThreshold || nowTime < endVal) {
          return true;
        }
      }
    }
    return false;
  }

  void _mostrarDialogoMotivoLlegadaTarde(BuildContext context) {
    final controller = TextEditingController();
    final theme = Theme.of(context);
    final currentUser = SupabaseConfig.supabase.auth.currentUser;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        title: Text(
          'Justificación de Ingreso Tardío',
          style: TextStyle(color: theme.colorScheme.primary, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Estás iniciando tu turno más de 30 minutos después del horario asignado. Por favor ingresa el motivo del ingreso tardío para registro de control:',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Ej. Trancón vehicular, calamidad familiar, retraso de transporte...',
                hintStyle: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.4)),
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancelar', style: TextStyle(color: theme.colorScheme.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.black,
            ),
            onPressed: () async {
              final text = controller.text.trim();
              if (text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Por favor, ingresa una justificación.')),
                );
                return;
              }
              Navigator.pop(ctx);
              await ref.read(turnoProvider.notifier).iniciar(_institucionId, currentUser!.id, motivoTarde: text);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Turno iniciado con éxito.')),
                );
              }
            },
            child: const Text('Guardar e Iniciar', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _mostrarConfirmacionLogout(BuildContext context) {
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        title: const Text('¿Cerrar Sesión?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: const Text('¿Estás seguro de que deseas salir del sistema de control Vigia?', style: TextStyle(fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancelar', style: TextStyle(color: theme.colorScheme.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authProvider).signOut();
              if (context.mounted) context.replace('/login');
            },
            child: const Text('Cerrar Sesión'),
          ),
        ],
      ),
    );
  }

  Future<void> _verificarAnuncioActivo() async {
    try {
      final nowIso = DateTime.now().toUtc().toIso8601String();
      final res = await SupabaseConfig.supabase
          .from('anuncios')
          .select()
          .or('tipo.eq.movil,tipo.eq.ambos')
          .gt('fecha_fin', nowIso)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _anuncioActivo = res;
        });
      }
    } catch (_) {}
  }

  void _suscribirAnuncios() {
    _anunciosChannel = SupabaseConfig.supabase
        .channel('anuncios-en-vivo')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'anuncios',
          callback: (payload) => _verificarAnuncioActivo(),
        )
        .subscribe();
  }

  Widget _buildBannerAnuncio(ThemeData theme) {
    return GestureDetector(
      onTap: () => _mostrarDetalleAnuncio(context),
      child: Container(
        width: double.infinity,
        color: theme.colorScheme.error,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '¡ALERTA DE SISTEMA!: ${_anuncioActivo!['titulo']}',
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 12),
          ],
        ),
      ),
    );
  }

  void _mostrarDetalleAnuncio(BuildContext context) {
    final theme = Theme.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: theme.colorScheme.error.withOpacity(0.1),
                border: Border.all(color: theme.colorScheme.error.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'ACTUALIZACIÓN / MANTENIMIENTO',
                style: TextStyle(color: theme.colorScheme.error, fontSize: 9, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _anuncioActivo!['titulo'] ?? 'Aviso Importante',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              "Programado hasta: ${DateFormat('dd MMM, hh:mm a').format(DateTime.parse(_anuncioActivo!['fecha_fin']))}",
              style: TextStyle(fontSize: 10, color: theme.colorScheme.outline),
            ),
            const SizedBox(height: 16),
            Text(
              _anuncioActivo!['descripcion'] ?? '',
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.error,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Entendido', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
