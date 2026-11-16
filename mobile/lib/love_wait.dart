import 'package:flutter/material.dart';

class LoveWait extends StatefulWidget {
  const LoveWait({super.key});

  @override
  State<LoveWait> createState() => _LoveWaitState();
}

class _LoveWaitState extends State<LoveWait> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xC7F3EEE4),
      child: Center(
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.86, end: 1.18).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut)),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.favorite, color: Color(0xFFE84AA8), size: 72),
              SizedBox(height: 8),
              Text('One moment', style: TextStyle(color: Color(0xFFE84AA8), fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}

void showNote(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}
