import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class LectorQr extends StatelessWidget {
  final void Function(String codigo) onDetect;

  const LectorQr({super.key, required this.onDetect});

  Widget build(BuildContext context) {
    return MobileScanner(
      onDetect: (capture) {
        final code = capture.barcodes.first.rawValue;
        if (code != null) onDetect(code);
      },
    );
  }
}
