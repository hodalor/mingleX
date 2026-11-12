import 'package:flutter/material.dart';
import 'deck_screen.dart';
import 'love_wait.dart';
import 'minglex_api.dart';

class AuthFlow extends StatefulWidget {
  const AuthFlow({super.key});

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

enum _Step { start, email, phone, code, onboarding, home, trouble, terms }

class _AuthFlowState extends State<AuthFlow> {
  final _api = MinglexApi();
  _Step _step = _Step.start;
  bool _busy = false;
  String _error = '';
  String _phone = '';
  String? _devCode;
  String? _token;
  bool _creating = false;

  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _birthDate = TextEditingController();
  final _national = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  String _gender = 'woman';
  bool _resetSent = false;
  String _countryCode = '+1';

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _birthDate.dispose();
    _national.dispose();
    _code.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await action();
    } on ApiException catch (error) {
      setState(() => _error = error.message);
      if (mounted) showNote(context, error.message);
    } catch (_) {
      setState(() => _error = 'Something went wrong. Try again.');
      if (mounted) showNote(context, 'Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _accept(Map<String, dynamic> result) {
    final user = result['user'] as Map<String, dynamic>? ?? {};
    final needsOnboarding = result['needsOnboarding'] == true || user['needsOnboarding'] == true;
    setState(() {
      _token = result['token']?.toString();
      _step = needsOnboarding ? _Step.onboarding : _Step.home;
      _error = '';
    });
  }

  Future<void> _social(String provider) async {
    await _run(() async {
      final config = await _api.getJson('/api/auth/providers');
      final configured = provider == 'google' ? config['google'] == true : config['apple'] == true;
      if (!configured && config['devPreview'] == true) {
        final identity = await _api.devIdentity(provider);
        _accept(await _api.postJson('/api/auth/dev/$provider', identity));
        return;
      }
      throw ApiException(
        configured
            ? 'Finish ${provider == 'google' ? 'Google' : 'Apple'} in the phone settings, then try again.'
            : '${provider == 'google' ? 'Google' : 'Apple'} sign-in is not configured yet',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          SafeArea(
            child: switch (_step) {
              _Step.start => _start(),
              _Step.email => _emailForm(),
              _Step.phone => _phoneForm(),
              _Step.code => _codeForm(),
              _Step.onboarding => _onboarding(),
              _Step.home => _home(),
              _Step.trouble => _trouble(),
              _Step.terms => _terms(),
            },
          ),
          if (_busy) const LoveWait(),
        ],
      ),
    );
  }

  Widget _start() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
      children: [
        const Icon(Icons.spa, color: Color(0xFF1F6F54), size: 48),
        const SizedBox(height: 28),
        const Text('Get Started', textAlign: TextAlign.center, style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        const Text(
          'By tapping Log in or Continue, you agree to the mingleX Terms. mingleX is for adults 18 and older.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 16, height: 1.35),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: () => setState(() => _step = _Step.terms), child: const Text('Read the Terms')),
        if (_error.isNotEmpty) _errorBox(),
        const SizedBox(height: 12),
        _outline('Log in with email', Icons.mail_outline, () => setState(() => _step = _Step.email)),
        const SizedBox(height: 12),
        _filled('Continue with Google', Icons.g_mobiledata, const Color(0xFF1A73E8), () => _social('google')),
        const SizedBox(height: 12),
        _filled('Continue with Apple', Icons.apple, const Color(0xFF1C2B24), () => _social('apple')),
        const SizedBox(height: 12),
        _outline('Log in with phone number', Icons.phone_outlined, () => setState(() => _step = _Step.phone)),
        TextButton(onPressed: () => setState(() => _step = _Step.trouble), child: const Text('Trouble logging in?')),
      ],
    );
  }

  Widget _emailForm() {
    return _page(
      title: _creating ? 'Create account' : 'Log in with email',
      onBack: () => setState(() => _step = _Step.start),
      children: [
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 12),
        TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
        if (_creating) ...[
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'First name')),
          const SizedBox(height: 12),
          TextField(controller: _birthDate, decoration: const InputDecoration(labelText: 'Birthday YYYY-MM-DD')),
          const SizedBox(height: 12),
          _genders(),
          const Text('mingleX is for adults 18 and older.'),
        ],
        const SizedBox(height: 16),
        _submit(_creating ? 'Agree and continue' : 'Log in', () {
          _run(() async {
            final path = _creating ? '/api/auth/register' : '/api/auth/login';
            final body = {
              'email': _email.text.trim(),
              'password': _password.text,
              if (_creating) 'name': _name.text.trim(),
              if (_creating) 'birthDate': _birthDate.text.trim(),
              if (_creating) 'gender': _gender,
            };
            _accept(await _api.postJson(path, body));
          });
        }),
        if (!_creating)
          TextButton(
            onPressed: () => setState(() {
              _resetSent = false;
              _devCode = null;
              _step = _Step.trouble;
            }),
            child: const Text('Forgot password?'),
          ),
        TextButton(
          onPressed: () => setState(() => _creating = !_creating),
          child: Text(_creating ? 'Already have an account? Log in' : 'New here? Create an account'),
        ),
      ],
    );
  }

  Widget _phoneForm() {
    return _page(
      title: 'My number is',
      onBack: () => setState(() => _step = _Step.start),
      children: [
        Row(
          children: [
            DropdownButton<String>(
              value: _countryCode,
              items: const ['+1', '+44', '+234', '+233', '+254', '+27', '+91', '+61']
                  .map((code) => DropdownMenuItem(value: code, child: Text(code)))
                  .toList(),
              onChanged: (value) => setState(() => _countryCode = value ?? '+1'),
            ),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _national, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number'))),
          ],
        ),
        const SizedBox(height: 16),
        _submit('Continue', () {
          final digits = _national.text.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');
          final phone = '$_countryCode$digits';
          _run(() async {
            final result = await _api.postJson('/api/auth/phone/send', {'phone': phone});
            setState(() {
              _phone = phone;
              _devCode = result['devCode']?.toString();
              _step = _Step.code;
            });
          });
        }),
      ],
    );
  }

  Widget _codeForm() {
    return _page(
      title: 'Enter your code',
      onBack: () => setState(() => _step = _Step.phone),
      children: [
        Text('We sent a 6-digit code to $_phone.'),
        if (_devCode != null) Text('Development code: $_devCode', style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        TextField(controller: _code, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '6-digit code')),
        const SizedBox(height: 16),
        _submit('Continue', () {
          _run(() async {
            _accept(await _api.postJson('/api/auth/phone/verify', {'phone': _phone, 'code': _code.text.trim()}));
          });
        }),
      ],
    );
  }

  Widget _onboarding() {
    return _page(
      title: 'Welcome',
      children: [
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'First name')),
        const SizedBox(height: 12),
        TextField(controller: _birthDate, decoration: const InputDecoration(labelText: 'Birthday YYYY-MM-DD')),
        const SizedBox(height: 12),
        _genders(),
        const Text('mingleX is for adults 18 and older.'),
        const SizedBox(height: 16),
        _submit('Continue', () {
          _run(() async {
            await _api.patchJson('/api/me', {
              'name': _name.text.trim(),
              'birthDate': _birthDate.text.trim(),
              'gender': _gender,
            }, token: _token);
            setState(() => _step = _Step.home);
          });
        }),
      ],
    );
  }

  Widget _home() {
    final token = _token;
    if (token == null) return _start();
    return DeckScreen(
      api: _api,
      token: token,
      onSignOut: () {
        setState(() {
          _token = null;
          _step = _Step.start;
        });
      },
    );
  }

  Widget _trouble() {
    return _page(
      title: 'Reset password',
      onBack: () => setState(() => _step = _Step.start),
      children: [
        const Text('Enter the email on the account. We send a 6-digit code there. It expires in 10 minutes. Google, Apple, and phone still open the same profile.'),
        const SizedBox(height: 12),
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 12),
        _submit('Send code', () {
          _run(() async {
            final result = await _api.postJson('/api/auth/password/forgot', {'email': _email.text.trim()});
            setState(() {
              _resetSent = true;
              _devCode = result['devCode']?.toString();
            });
            if (mounted) showNote(context, result['devCode'] == null ? 'If that email is on mingleX, the code is in the inbox.' : 'Code ready on this screen.');
          });
        }),
        if (_devCode != null && _devCode!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text('Development code: $_devCode', style: const TextStyle(color: Color(0xFF8A5A12), fontWeight: FontWeight.w700)),
          ),
        const SizedBox(height: 12),
        TextField(controller: _code, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '6-digit code')),
        const SizedBox(height: 12),
        TextField(controller: _newPassword, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
        const SizedBox(height: 16),
        _submit('Save password and sign in', () {
          if (!_resetSent) return;
          _run(() async {
            _accept(await _api.postJson('/api/auth/password/reset', {
              'email': _email.text.trim(),
              'code': _code.text.trim(),
              'password': _newPassword.text,
            }));
          });
        }),
      ],
    );
  }

  Widget _terms() {
    return _page(
      title: 'Terms',
      onBack: () => setState(() => _step = _Step.start),
      children: const [
        Text('mingleX is for adults 18 and older. Harassment, fake profiles, and sexual content involving minors are not allowed.'),
      ],
    );
  }

  Widget _page({required String title, required List<Widget> children, VoidCallback? onBack}) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      children: [
        if (onBack != null) Align(alignment: Alignment.centerLeft, child: IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back))),
        Text(title, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        if (_error.isNotEmpty) _errorBox(),
        ...children,
      ],
    );
  }

  Widget _genders() {
    return Wrap(
      spacing: 8,
      children: [
        for (final item in const [('woman', 'Woman'), ('man', 'Man'), ('nonbinary', 'Nonbinary')])
          ChoiceChip(
            label: Text(item.$2),
            selected: _gender == item.$1,
            onSelected: (_) => setState(() => _gender = item.$1),
          ),
      ],
    );
  }

  Widget _outline(String label, IconData icon, VoidCallback onPressed) {
    return OutlinedButton.icon(
      onPressed: _busy ? null : onPressed,
      icon: Icon(icon),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        foregroundColor: const Color(0xFF1C2B24),
        side: const BorderSide(color: Color(0xFFD5CEC2), width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }

  Widget _filled(String label, IconData icon, Color background, VoidCallback onPressed, {Color foreground = Colors.white}) {
    return FilledButton.icon(
      onPressed: _busy ? null : onPressed,
      icon: Icon(icon),
      label: Text(label),
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        backgroundColor: background,
        foregroundColor: foreground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }

  Widget _submit(String label, VoidCallback onPressed) {
    return FilledButton(
      onPressed: _busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        backgroundColor: const Color(0xFF1F6F54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }

  Widget _errorBox() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFF8E6E1), borderRadius: BorderRadius.circular(12)),
      child: Text(_error, style: const TextStyle(color: Color(0xFF8C3A32))),
    );
  }
}
