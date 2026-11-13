import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'minglex_api.dart';

bool firebaseReady = false;

@pragma('vm:entry-point')
Future<void> minglexBackgroundMessage(RemoteMessage message) async {}

Future<void> prepareFirebase() async {
  try {
    await Firebase.initializeApp();
    firebaseReady = true;
    FirebaseMessaging.onBackgroundMessage(minglexBackgroundMessage);
  } catch (_) {
    firebaseReady = false;
  }
}

Future<void> registerDevice(MinglexApi api, String token, void Function(String note) onForeground) async {
  if (!firebaseReady) return;
  try {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    // Closed-app alerts still go to this registration token. The newer install id is a different target.
    // ignore: deprecated_member_use
    final device = await messaging.getToken();
    if (device != null && device.isNotEmpty) {
      await api.postJson('/api/me/device', {'token': device}, token: token);
    }
    FirebaseMessaging.onMessage.listen((message) {
      final note = [message.notification?.title, message.notification?.body].whereType<String>().where((part) => part.isNotEmpty).join('. ');
      if (note.isNotEmpty) onForeground(note);
    });
  } catch (_) {}
}
