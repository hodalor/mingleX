import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'country_codes.dart';
import 'deck_screen.dart';
import 'love_wait.dart';
import 'minglex_api.dart';
import 'push.dart';

class AuthFlow extends StatefulWidget {
  const AuthFlow({super.key});

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

enum _Step { start, email, phone, code, phonePassword, onboarding, home, trouble, terms }

class _AuthFlowState extends State<AuthFlow> {
  final _api = MinglexApi();
  _Step _step = _Step.start;
  bool _busy = false;
  String _error = '';
  String _phone = '';
  String? _verificationId;
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
  String _countryIso = 'GH';
  String _signupIso = 'GH';
  String _emailStage = 'contact';
  String _emailProof = '';
  String _phoneProof = '';
  String _proof = '';
  String? _signupVerificationId;
  PhoneAuthCredential? _signupCredential;
  final _signupNational = TextEditingController();
  final _emailCode = TextEditingController();
  final _phoneCode = TextEditingController();
  String _signupPhoneValue = '';

  String _dialFor(String iso) =>
      kCountryCodes.firstWhere((country) => country.iso == iso, orElse: () => kCountryCodes.firstWhere((c) => c.iso == 'GH')).dial;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _birthDate.dispose();
    _national.dispose();
    _code.dispose();
    _newPassword.dispose();
    _signupNational.dispose();
    _emailCode.dispose();
    _phoneCode.dispose();
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

  void _afterPhone(Map<String, dynamic> result) {
    if (result['needsPassword'] == true) {
      setState(() {
        _proof = result['proof']?.toString() ?? '';
        _step = _Step.phonePassword;
        _error = '';
      });
      return;
    }
    _accept(result);
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

  Future<void> _firebasePhone(String phone, {bool signup = false}) async {
    if (!firebaseReady) throw ApiException('Phone verification is not ready on this device.');
    final done = Completer<void>();
    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: phone,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (credential) {
        if (signup) {
          _signupCredential = credential;
          if (!done.isCompleted) done.complete();
          return;
        }
        _run(() => _finishFirebase(credential));
      },
      verificationFailed: (error) {
        final message = error.message ?? 'Phone sign-in failed';
        if (!done.isCompleted) done.completeError(ApiException(message));
        if (mounted && !signup) showNote(context, message);
      },
      codeSent: (verificationId, _) {
        if (signup) {
          _signupVerificationId = verificationId;
        } else {
          setState(() {
            _phone = phone;
            _verificationId = verificationId;
            _step = _Step.code;
          });
        }
        if (!done.isCompleted) done.complete();
      },
      codeAutoRetrievalTimeout: (_) {},
    );
    if (signup) await done.future;
  }

  Future<String?> _signupPhoneToken(String code) async {
    final credential = _signupCredential ??
        (_signupVerificationId == null
            ? null
            : PhoneAuthProvider.credential(verificationId: _signupVerificationId!, smsCode: code));
    if (credential == null) throw ApiException('Send the code to your number first');
    final signedIn = await FirebaseAuth.instance.signInWithCredential(credential);
    return signedIn.user?.getIdToken();
  }

  Future<void> _finishFirebase(PhoneAuthCredential credential) async {
    final signedIn = await FirebaseAuth.instance.signInWithCredential(credential);
    final idToken = await signedIn.user?.getIdToken();
    if (idToken == null) throw ApiException('Phone sign-in failed');
    _afterPhone(await _api.postJson('/api/auth/phone/firebase', {'idToken': idToken}));
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
              _Step.phonePassword => _phonePassword(),
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
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Image.asset('assets/app_icon.png', width: 72, height: 72, fit: BoxFit.cover),
        ),
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
        _filled('Continue with Apple', Icons.apple, const Color(0xFF161D2F), () => _social('apple')),
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
        if (!_creating || _emailStage == 'contact')
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        if (!_creating) ...[
          const SizedBox(height: 12),
          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
        ],
        if (_creating && _emailStage == 'contact') ...[
          const SizedBox(height: 12),
          const Text('Phone is optional. Leave it blank to verify with email only.'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: DropdownButtonFormField<String>(
                  value: _signupIso,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Country'),
                  items: kCountryCodes
                      .map((country) => DropdownMenuItem(
                            value: country.iso,
                            child: Text('${country.name} (${country.dial})', overflow: TextOverflow.ellipsis),
                          ))
                      .toList(),
                  onChanged: _busy ? null : (value) => setState(() => _signupIso = value ?? 'GH'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _signupNational,
                  enabled: !_busy,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text('We send a 6-digit code before you can choose a password.'),
        ],
        if (_creating && _emailStage == 'code') ...[
          TextField(controller: _emailCode, enabled: !_busy, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Email code')),
          if (_signupPhoneValue.isNotEmpty) ...[
            const SizedBox(height: 12),
            TextField(controller: _phoneCode, enabled: !_busy, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Phone code')),
          ],
          const Text('The code is in your inbox, and on your phone if you added a number. It is not shown here.'),
        ],
        if (_creating && _emailStage == 'password') ...[
          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'First name')),
          const SizedBox(height: 12),
          TextField(controller: _birthDate, decoration: const InputDecoration(labelText: 'Birthday YYYY-MM-DD')),
          const SizedBox(height: 12),
          _genders(),
          const Text('mingleX is for adults 18 and older.'),
        ],
        const SizedBox(height: 16),
        _submit(
          _busy
              ? 'Please wait…'
              : _creating
                  ? (_emailStage == 'password'
                      ? 'Agree and continue'
                      : _emailStage == 'code'
                          ? 'Verify codes'
                          : 'Continue')
                  : 'Log in',
          () {
          _run(() async {
            if (!_creating) {
              _accept(await _api.postJson('/api/auth/login', {'email': _email.text.trim(), 'password': _password.text}));
              return;
            }
            if (_emailStage == 'contact') {
              final digits = _signupNational.text.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');
              final phone = digits.isEmpty ? '' : '${_dialFor(_signupIso)}$digits';
              await _api.postJson('/api/auth/signup/send', {
                'email': _email.text.trim(),
                if (phone.isNotEmpty) 'phone': phone,
              });
              if (phone.isNotEmpty) {
                _signupCredential = null;
                _signupVerificationId = null;
                await _firebasePhone(phone, signup: true);
              }
              setState(() {
                _signupPhoneValue = phone;
                _emailStage = 'code';
              });
              return;
            }
            if (_emailStage == 'code') {
              final phone = _signupPhoneValue;
              final idToken = phone.isEmpty ? null : await _signupPhoneToken(_phoneCode.text.trim());
              final result = await _api.postJson('/api/auth/signup/confirm', {
                'email': _email.text.trim(),
                'emailCode': _emailCode.text.trim(),
                if (phone.isNotEmpty) 'phone': phone,
                if (idToken != null) 'firebaseIdToken': idToken,
              });
              setState(() {
                _emailProof = result['emailProof']?.toString() ?? '';
                _phoneProof = result['phoneProof']?.toString() ?? '';
                _emailStage = 'password';
              });
              return;
            }
            final phone = _signupPhoneValue;
            _accept(await _api.postJson('/api/auth/register', {
              'email': _email.text.trim(),
              'emailProof': _emailProof,
              'password': _password.text,
              'name': _name.text.trim(),
              'birthDate': _birthDate.text.trim(),
              'gender': _gender,
              if (phone.isNotEmpty && _phoneProof.isNotEmpty) 'phone': phone,
              if (phone.isNotEmpty && _phoneProof.isNotEmpty) 'phoneProof': _phoneProof,
            }));
          });
        }),
        if (!_creating)
          TextButton(
            onPressed: () => setState(() {
              _resetSent = false;
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
        DropdownButtonFormField<String>(
          value: _countryIso,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Country code'),
          items: kCountryCodes
              .map((country) => DropdownMenuItem(
                    value: country.iso,
                    child: Text('${country.name} (${country.dial})', overflow: TextOverflow.ellipsis),
                  ))
              .toList(),
          onChanged: _busy ? null : (value) => setState(() => _countryIso = value ?? 'GH'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _national,
          enabled: !_busy,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Phone number'),
        ),
        const SizedBox(height: 16),
        _submit(_busy ? 'Sending code…' : 'Continue', () {
          final digits = _national.text.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');
          final phone = '${_dialFor(_countryIso)}$digits';
          _run(() async {
            await _firebasePhone(phone);
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
        Text('We sent a 6-digit code to $_phone. It is on your phone, not on this screen.'),
        const SizedBox(height: 12),
        TextField(controller: _code, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '6-digit code')),
        const SizedBox(height: 16),
        _submit('Continue', () {
          _run(() async {
            if (_verificationId == null) throw ApiException('Send the code to your number first');
            final credential = PhoneAuthProvider.credential(verificationId: _verificationId!, smsCode: _code.text.trim());
            await _finishFirebase(credential);
          });
        }),
      ],
    );
  }

  Widget _phonePassword() {
    return _page(
      title: 'Choose a password',
      onBack: () => setState(() => _step = _Step.phone),
      children: [
        const Text('The number is confirmed. Set a password before the account opens.'),
        const SizedBox(height: 12),
        TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'First name')),
        const SizedBox(height: 12),
        TextField(controller: _birthDate, decoration: const InputDecoration(labelText: 'Birthday YYYY-MM-DD')),
        const SizedBox(height: 12),
        _genders(),
        const Text('mingleX is for adults 18 and older.'),
        const SizedBox(height: 16),
        _submit('Agree and continue', () {
          _run(() async {
            _accept(await _api.postJson('/api/auth/phone/complete', {
              'phone': _phone,
              'proof': _proof,
              'password': _password.text,
              'name': _name.text.trim(),
              'birthDate': _birthDate.text.trim(),
              'gender': _gender,
            }));
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
            await _api.postJson('/api/auth/password/forgot', {'email': _email.text.trim()});
            setState(() => _resetSent = true);
            if (mounted) showNote(context, 'If that email is on mingleX, the code is in the inbox.');
          });
        }),
        if (_resetSent) const Text('If that email is on mingleX, the code is in the inbox. It expires in 10 minutes.'),
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
        foregroundColor: const Color(0xFFF4F1FF),
        side: const BorderSide(color: Color(0xFF2A3348), width: 2),
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
        backgroundColor: const Color(0xFFE84AA8),
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
      decoration: BoxDecoration(color: const Color(0xFF3A1D28), borderRadius: BorderRadius.circular(12)),
      child: Text(_error, style: const TextStyle(color: Color(0xFFFF6B7A))),
    );
  }
}
