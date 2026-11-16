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
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F1524),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFE84AA8),
          secondary: Color(0xFF2EE6C5),
          surface: Color(0xFF161D2F),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF161D2F),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      home: const AuthFlow(),
    );
  }
}
