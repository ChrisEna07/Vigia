import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static const _surface = Color(0xFF0D0D0D);
  static const _card = Color(0xFF1A1A1A);
  static const _border = Color(0xFF2A2A2A);
  static const _accent = Color(0xFF4ADE80);
  static const _accentDim = Color(0xFF22C55E);
  static const _danger = Color(0xFFEF4444);
  static const _textPrimary = Color(0xFFF5F5F5);
  static const _textSecondary = Color(0xFFA0A0A0);
  static const _textMuted = Color(0xFF6B6B6B);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: _surface,
      colorScheme: const ColorScheme.dark(
        surface: _surface,
        primary: _accent,
        secondary: _accentDim,
        error: _danger,
        onSurface: _textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: _card,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: _textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: _card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: _border, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _accent, width: 1.5),
        ),
        labelStyle: const TextStyle(color: _textSecondary),
        hintStyle: const TextStyle(color: _textMuted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _accent,
          foregroundColor: _surface,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textTheme: GoogleFonts.interTextTheme().copyWith(
        headlineLarge: const TextStyle(color: _textPrimary, fontSize: 28, fontWeight: FontWeight.w700),
        titleLarge: const TextStyle(color: _textPrimary, fontSize: 20, fontWeight: FontWeight.w600),
        titleMedium: const TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        bodyLarge: const TextStyle(color: _textPrimary, fontSize: 16),
        bodyMedium: const TextStyle(color: _textSecondary, fontSize: 14),
        labelLarge: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
      ),
      dividerTheme: const DividerThemeData(color: _border, thickness: 1),
    );
  }
}
