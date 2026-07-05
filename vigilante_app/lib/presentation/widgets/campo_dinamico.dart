import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class CampoDinamico extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final Widget? suffix;
  final int maxLines;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;

  const CampoDinamico({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.suffix,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
  });

  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        suffixIcon: suffix,
      ),
    );
  }
}
