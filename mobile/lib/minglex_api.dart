import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

String minglexApiBase() {
  return 'https://minglex-31319355631.europe-west9.run.app';
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class MinglexApi {
  MinglexApi({String? baseUrl}) : baseUrl = baseUrl ?? minglexApiBase();

  final String baseUrl;

  Future<Map<String, dynamic>> getJson(String path, {String? token}) {
    return _send('GET', path, token: token);
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body, {String? token}) {
    return _send('POST', path, body: body, token: token);
  }

  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> body, {String? token}) {
    return _send('PATCH', path, body: body, token: token);
  }

  Future<Map<String, dynamic>> deleteJson(String path, {String? token, Map<String, dynamic>? body}) {
    return _send('DELETE', path, token: token, body: body);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';

    late http.Response response;
    try {
      response = await switch (method) {
        'POST' => http.post(uri, headers: headers, body: jsonEncode(body)),
        'PATCH' => http.patch(uri, headers: headers, body: jsonEncode(body)),
        'DELETE' => http.delete(uri, headers: headers, body: body == null ? null : jsonEncode(body)),
        _ => http.get(uri, headers: headers),
      };
    } catch (_) {
      throw ApiException("Can't reach the mingleX API. Start the backend and check MongoDB Atlas.");
    }

    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    final data = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    if (response.statusCode >= 400) {
      throw ApiException(data['message']?.toString() ?? 'Request failed');
    }
    return data;
  }

  Future<void> uploadPhoto(String filePath, String token, {String path = '/api/me/photos'}) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl$path'));
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('photo', filePath));
    late http.StreamedResponse streamed;
    try {
      streamed = await request.send();
    } catch (_) {
      throw ApiException("Can't reach the mingleX API. Start the backend and check MongoDB Atlas.");
    }
    final response = await http.Response.fromStream(streamed);
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    final data = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    if (response.statusCode >= 400) {
      throw ApiException(data['message']?.toString() ?? "That photo didn't upload.");
    }
  }

  String mediaUrl(String url) {
    final gcs = RegExp(r'^https://storage\.googleapis\.com/[^/]+/([^?#]+)').firstMatch(url);
    if (gcs != null) return '$baseUrl/media/${Uri.decodeComponent(gcs.group(1)!)}';
    if (url.startsWith('/uploads/')) return '$baseUrl/media/${url.substring('/uploads/'.length)}';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$baseUrl$url';
  }

  Future<Map<String, String>> devIdentity(String provider) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'minglex.dev.$provider';
    final existing = prefs.getString(key);
    if (existing != null) {
      final decoded = jsonDecode(existing);
      if (decoded is Map<String, dynamic>) {
        return decoded.map((name, value) => MapEntry(name, value.toString()));
      }
    }
    final subject = DateTime.now().microsecondsSinceEpoch.toString();
    final identity = {
      'subject': subject,
      'email': '$provider.$subject@dev.minglex.app',
      'name': '',
    };
    await prefs.setString(key, jsonEncode(identity));
    return identity;
  }
}
