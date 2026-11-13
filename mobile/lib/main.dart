import 'package:flutter/material.dart';
import 'auth_flow.dart';
import 'push.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await prepareFirebase();
  runApp(const MinglexApp());
}

class MinglexApp extends StatelessWidget {
  const MinglexApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'mingleX',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF3EEE4),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF1F6F54),
          surface: Color(0xFFF3EEE4),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFFFFDF8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      home: const AuthFlow(),
    );
  }
}
