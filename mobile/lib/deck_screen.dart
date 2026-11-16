import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'love_wait.dart';
import 'minglex_api.dart';
import 'push.dart';

class DeckScreen extends StatefulWidget {
  const DeckScreen({super.key, required this.api, required this.token, required this.onSignOut});

  final MinglexApi api;
  final String token;
  final VoidCallback onSignOut;

  @override
  State<DeckScreen> createState() => _DeckScreenState();
}

class _DeckScreenState extends State<DeckScreen> {
  final _hello = TextEditingController();
  final _draft = TextEditingController();
  final _bio = TextEditingController();
  final _job = TextEditingController();
  final _height = TextEditingController();
  final _name = TextEditingController();
  final _city = TextEditingController();
  final _phoneNational = TextEditingController();
  final _phoneCode = TextEditingController();
  int _tab = 0;
  bool _loading = true;
  bool _busy = false;
  bool _incomplete = false;
  bool _locationRequired = false;
  String _error = '';
  List<Map<String, dynamic>> _profiles = [];
  List<Map<String, dynamic>> _matches = [];
  List<Map<String, dynamic>> _incoming = [];
  List<Map<String, dynamic>> _outgoing = [];
  bool _incomingLocked = false;
  String _peopleTab = 'matches';
  Map<String, dynamic> _access = {};
  bool _showPlus = false;
  Map<String, dynamic>? _celebration;
  Map<String, dynamic>? _openMatch;
  List<Map<String, dynamic>> _messages = [];
  Timer? _messagePoll;
  double _radius = 100;
  double _minAge = 18;
  double _maxAge = 80;
  List<String> _interested = ['woman', 'man', 'nonbinary'];
  List<String> _hobbies = [];
  String _lookingFor = '';
  String _drinking = '';
  String _smoking = '';
  String _workout = '';
  String _pets = '';
  String _education = '';
  String _kids = '';
  String _gender = 'woman';
  String _email = '';
  String _phone = '';
  bool _phoneSent = false;
  String? _profileVerificationId;
  bool _profileOpen = false;
  List<Map<String, dynamic>> _photos = [];
  String _photoCheck = 'none';
  String _videoCheck = 'none';
  int _cardPhoto = 0;
  String _cardId = '';
  Map<String, dynamic>? _viewing;
  String _viewKind = '';

  @override
  void initState() {
    super.initState();
    _refresh();
    unawaited(registerDevice(widget.api, widget.token, (note) {
      if (mounted) showNote(context, note);
    }));
  }

  @override
  void dispose() {
    _hello.dispose();
    _draft.dispose();
    _bio.dispose();
    _job.dispose();
    _height.dispose();
    _name.dispose();
    _city.dispose();
    _phoneNational.dispose();
    _phoneCode.dispose();
    _messagePoll?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final deck = await widget.api.getJson('/api/discover?limit=20', token: widget.token);
      final matches = await widget.api.getJson('/api/matches', token: widget.token);
      final requests = await widget.api.getJson('/api/requests', token: widget.token);
      final features = await widget.api.getJson('/api/features', token: widget.token);
      final me = await widget.api.getJson('/api/me', token: widget.token);
      if (!mounted) return;
      final user = me['user'];
      setState(() {
        _incomplete = deck['profileIncomplete'] == true;
        _locationRequired = deck['locationRequired'] == true;
        _profiles = _asList(deck['profiles']);
        _matches = _asList(matches['matches']);
        _incoming = _asList(requests['incoming']);
        _outgoing = _asList(requests['outgoing']);
        _incomingLocked = requests['incomingLocked'] == true;
        _showPlus = features['showPlusNote'] == true;
        final access = features['access'];
        _access = access is Map<String, dynamic> ? access : {};
        if (user is Map) {
          _radius = (user['discoveryRadiusKm'] as num?)?.toDouble() ?? _radius;
          _minAge = (user['discoveryMinAge'] as num?)?.toDouble() ?? _minAge;
          _maxAge = (user['discoveryMaxAge'] as num?)?.toDouble() ?? _maxAge;
          final interested = user['interestedIn'];
          if (interested is List && interested.isNotEmpty) {
            _interested = interested.map((item) => item.toString()).toList();
          }
          _bio.text = user['bio']?.toString() ?? '';
          _job.text = user['jobTitle']?.toString() ?? '';
          _height.text = user['heightCm'] == null ? '' : user['heightCm'].toString();
          final hobbies = user['interests'];
          _hobbies = hobbies is List ? hobbies.map((item) => item.toString()).toList() : [];
          _lookingFor = user['lookingFor']?.toString() ?? '';
          _drinking = user['drinking']?.toString() ?? '';
          _smoking = user['smoking']?.toString() ?? '';
          _workout = user['workout']?.toString() ?? '';
          _pets = user['pets']?.toString() ?? '';
          _education = user['education']?.toString() ?? '';
          _kids = user['kids']?.toString() ?? '';
          _gender = user['gender']?.toString().isNotEmpty == true ? user['gender'].toString() : _gender;
          _email = user['email']?.toString() ?? '';
          _phone = user['phone']?.toString() ?? '';
          _name.text = user['name']?.toString() ?? '';
          _city.text = user['city']?.toString() ?? '';
          final photos = user['photos'];
          _photos = photos is List ? photos.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList() : [];
          _photoCheck = user['photoCheck']?.toString() ?? 'none';
          _videoCheck = user['videoCheck']?.toString() ?? 'none';
        }
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _swipe(String direction) async {
    if (_profiles.isEmpty || _busy) return;
    final card = _profiles.first;
    setState(() {
      _busy = true;
      _error = '';
      _profiles = _profiles.sublist(1);
    });
    try {
      final result = await widget.api.postJson('/api/swipes', {
        'toUserId': card['id'],
        'direction': direction,
      }, token: widget.token);
      final match = result['match'];
      if (match is Map<String, dynamic> && match['pending'] != true && mounted) {
        setState(() => _celebration = match);
        showNote(context, 'You matched with ${card['name'] ?? 'them'}.');
      } else if (direction == 'like' && mounted) {
        showNote(context, 'Like sent. They can accept it from Requests.');
      } else if (direction == 'super' && mounted) {
        showNote(context, 'Super Like sent.');
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _profiles = [card, ..._profiles];
        _error = error.message;
      });
      showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final image = await ImagePicker().pickImage(source: source, maxWidth: 1600, imageQuality: 82);
    if (image == null) return;
    await _sendMedia(image.path, '/api/me/photos');
  }

  Future<void> _pickCheckPhoto() async {
    final image = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 82);
    if (image == null) return;
    await _sendMedia(image.path, '/api/me/verification/photo');
  }

  Future<void> _pickVideo(ImageSource source, String path) async {
    final video = await ImagePicker().pickVideo(source: source, maxDuration: const Duration(seconds: 20));
    if (video == null) return;
    await _sendMedia(video.path, path);
  }

  Future<void> _sendMedia(String path, String route) async {
    setState(() => _busy = true);
    try {
      await widget.api.uploadPhoto(path, widget.token, path: route);
      await _refresh();
      if (mounted && route != '/api/me/photos') showNote(context, 'Sent for review. The badge appears after the team approves it.');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _buyPlus() async {
    setState(() => _busy = true);
    try {
      final result = await widget.api.postJson('/api/billing/checkout', {}, token: widget.token);
      final url = result['authorizationUrl']?.toString() ?? '';
      if (url.isEmpty) throw ApiException('Checkout could not start.');
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened && mounted) showNote(context, url);
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _shareLocation() async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw ApiException('Location stays off until you allow it. You can still swipe.');
      }
      final position = await Geolocator.getCurrentPosition();
      await widget.api.patchJson('/api/me', {
        'location': {'lng': position.longitude, 'lat': position.latitude},
      }, token: widget.token);
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Location stays off until you allow it. You can still swipe.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendHello() async {
    final match = _celebration;
    final text = _hello.text.trim();
    if (match == null || text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await widget.api.postJson('/api/matches/${match['id']}/messages', {'text': text}, token: widget.token);
      if (!mounted) return;
      _hello.clear();
      setState(() {
        _celebration = null;
        _tab = 1;
      });
      _openChat(match);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loadMessages(Map<String, dynamic> match) async {
    try {
      final data = await widget.api.getJson('/api/matches/${match['id']}/messages', token: widget.token);
      if (!mounted || _openMatch?['id'] != match['id']) return;
      setState(() => _messages = _asList(data['messages']));
    } on ApiException catch (error) {
      if (mounted && _messages.isEmpty) setState(() => _error = error.message);
    }
  }

  void _openChat(Map<String, dynamic> match) {
    _messagePoll?.cancel();
    setState(() => _openMatch = match);
    _loadMessages(match);
    _messagePoll = Timer.periodic(const Duration(seconds: 5), (_) {
      final open = _openMatch;
      if (open != null && open['id'] == match['id']) _loadMessages(open);
    });
  }

  void _closeChat() {
    _messagePoll?.cancel();
    setState(() => _openMatch = null);
    _loadMatchList();
  }

  Future<void> _loadMatchList() async {
    try {
      final matches = await widget.api.getJson('/api/matches', token: widget.token);
      if (!mounted) return;
      setState(() => _matches = _asList(matches['matches']));
    } on ApiException {
      // The list already on screen stays until the next full refresh.
    }
  }

  Future<void> _sendMessage() async {
    final match = _openMatch;
    final text = _draft.text.trim();
    if (match == null || text.isEmpty) return;
    try {
      final result = await widget.api.postJson('/api/matches/${match['id']}/messages', {'text': text}, token: widget.token);
      final message = result['message'];
      if (message is Map<String, dynamic> && mounted) {
        _draft.clear();
        setState(() => _messages = [..._messages, message]);
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
          child: Row(
            children: [
              const Text('mingleX', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const Spacer(),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_horiz),
                onSelected: (value) {
                  if (value == 'profile') {
                    setState(() {
                      _profileOpen = true;
                      _openMatch = null;
                      _viewing = null;
                    });
                  }
                  if (value == 'out') widget.onSignOut();
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(value: 'profile', child: Text('My profile')),
                  PopupMenuItem(value: 'out', child: Text('Sign out')),
                ],
              ),
            ],
          ),
        ),
        if (_error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(_error, style: const TextStyle(color: Color(0xFFFF6B7A))),
          ),
        Expanded(
          child: Stack(
            children: [
              if (_loading)
                const Center(child: CircularProgressIndicator())
              else if (_profileOpen)
                _myProfile()
              else if (_openMatch != null)
                _chat()
              else if (_viewing != null)
                _personPage()
              else if (_tab == 2)
                _settings()
              else if (_tab == 1)
                _matchList()
              else
                _deck(),
              if (_celebration != null) _matchOverlay(),
            ],
          ),
        ),
        NavigationBar(
          backgroundColor: const Color(0xFF0F1524),
          selectedIndex: _tab,
          onDestinationSelected: (index) {
            final wasChatting = _openMatch != null;
            _messagePoll?.cancel();
            setState(() {
              _tab = index;
              _openMatch = null;
              _profileOpen = false;
              _viewing = null;
            });
            if (wasChatting) _loadMatchList();
          },
          destinations: const [
            NavigationDestination(icon: Icon(Icons.style_outlined), label: 'Discover'),
            NavigationDestination(icon: Icon(Icons.favorite_outline), label: 'Matches'),
            NavigationDestination(icon: Icon(Icons.tune), label: 'Settings'),
          ],
        ),
        ],
      ),
        if (_busy) const LoveWait(),
      ],
    );
  }

  Widget _settings() {
    const options = [
      ['woman', 'Women'],
      ['man', 'Men'],
      ['nonbinary', 'Nonbinary'],
    ];
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Discovery', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text('Choose who shows up in your deck.'),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: _busy ? null : _boost,
          child: const Text('Boost my profile'),
        ),
        const SizedBox(height: 16),
        const Text('Show me', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final option in options)
              FilterChip(
                label: Text(option[1]),
                selected: _interested.contains(option[0]),
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      if (!_interested.contains(option[0])) {
                        _interested = [..._interested, option[0]];
                      }
                    } else if (_interested.length > 1) {
                      _interested = _interested.where((item) => item != option[0]).toList();
                    }
                  });
                },
              ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Within ${_radius.round()} km', style: const TextStyle(fontWeight: FontWeight.w700)),
        Slider(
          min: 1,
          max: 500,
          divisions: 499,
          value: _radius,
          label: '${_radius.round()} km',
          onChanged: (value) => setState(() => _radius = value),
        ),
        Text('Youngest ${_minAge.round()}', style: const TextStyle(fontWeight: FontWeight.w700)),
        Slider(
          min: 18,
          max: 100,
          divisions: 82,
          value: _minAge,
          label: '${_minAge.round()}',
          onChanged: (value) => setState(() {
            _minAge = value;
            if (_minAge > _maxAge) _maxAge = _minAge;
          }),
        ),
        Text('Oldest ${_maxAge.round()}', style: const TextStyle(fontWeight: FontWeight.w700)),
        Slider(
          min: 18,
          max: 100,
          divisions: 82,
          value: _maxAge,
          label: '${_maxAge.round()}',
          onChanged: (value) => setState(() {
            _maxAge = value;
            if (_maxAge < _minAge) _minAge = _maxAge;
          }),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _busy ? null : _saveSettings,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(52)),
          child: const Text('Save discovery'),
        ),
        const SizedBox(height: 16),
        const Text('mingleX Plus', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const Text('One payment turns on the features this house has marked as paid.'),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _busy ? null : _buyPlus,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(52)),
          child: const Text('Get mingleX Plus'),
        ),
        const SizedBox(height: 28),
        const Text('About you', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text('These show on your card. Leave any of them blank.'),
        const SizedBox(height: 16),
        TextField(controller: _job, decoration: const InputDecoration(labelText: 'Work')),
        const SizedBox(height: 12),
        TextField(controller: _bio, maxLines: 3, maxLength: 500, decoration: const InputDecoration(labelText: 'Bio')),
        const SizedBox(height: 12),
        _choiceGroup('Looking for', _lookingFor, _lookingForChoices, (value) => setState(() => _lookingFor = value)),
        _choiceGroup('Drinking', _drinking, _drinkingChoices, (value) => setState(() => _drinking = value)),
        _choiceGroup('Smoking', _smoking, _smokingChoices, (value) => setState(() => _smoking = value)),
        _choiceGroup('Workout', _workout, _workoutChoices, (value) => setState(() => _workout = value)),
        _choiceGroup('Pets', _pets, _petsChoices, (value) => setState(() => _pets = value)),
        _choiceGroup('Kids', _kids, _kidsChoices, (value) => setState(() => _kids = value)),
        _choiceGroup('Education', _education, _educationChoices, (value) => setState(() => _education = value)),
        TextField(
          controller: _height,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Height in cm', hintText: 'Optional'),
        ),
        const SizedBox(height: 16),
        const Text('Hobbies', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final hobby in {..._hobbyChoices, ..._hobbies})
              FilterChip(
                label: Text(hobby),
                selected: _hobbies.contains(hobby),
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      if (!_hobbies.contains(hobby) && _hobbies.length < 8) {
                        _hobbies = [..._hobbies, hobby];
                      }
                    } else {
                      _hobbies = _hobbies.where((item) => item != hobby).toList();
                    }
                  });
                },
              ),
          ],
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _saveAbout,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(52)),
          child: const Text('Save about you'),
        ),
      ],
    );
  }

  Widget _choiceGroup(String title, String selected, List<List<String>> options, ValueChanged<String> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in options)
                FilterChip(
                  label: Text(option[1]),
                  selected: selected == option[0],
                  onSelected: (_) => onChanged(selected == option[0] ? '' : option[0]),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _saveAbout() async {
    final rawHeight = _height.text.trim();
    int? heightCm;
    if (rawHeight.isNotEmpty) {
      heightCm = int.tryParse(rawHeight);
      if (heightCm == null || heightCm < 140 || heightCm > 220) {
        setState(() => _error = 'Height should be between 140 and 220 cm.');
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await widget.api.patchJson('/api/me', {
        'bio': _bio.text.trim(),
        'jobTitle': _job.text.trim(),
        'interests': _hobbies,
        'lookingFor': _lookingFor.isEmpty ? null : _lookingFor,
        'drinking': _drinking.isEmpty ? null : _drinking,
        'smoking': _smoking.isEmpty ? null : _smoking,
        'workout': _workout.isEmpty ? null : _workout,
        'pets': _pets.isEmpty ? null : _pets,
        'education': _education.isEmpty ? null : _education,
        'kids': _kids.isEmpty ? null : _kids,
        'heightCm': heightCm,
      }, token: widget.token);
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveSettings() async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await widget.api.patchJson('/api/me', {
        'interestedIn': _interested,
        'discoveryRadiusKm': _radius.round(),
        'discoveryMinAge': _minAge.round(),
        'discoveryMaxAge': _maxAge.round(),
      }, token: widget.token);
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _safetySheet(Map<String, dynamic> profile) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF161D2F),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_titleOf(profile), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text('Blocking hides you from each other. A report also goes to mingleX staff.'),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(context, 'block'),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(48)),
                child: const Text('Block'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.pop(context, 'report'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: const Text('Report'),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || action == null) return;
    if (action == 'block') {
      await _block(profile);
      return;
    }
    await _reportSheet(profile);
  }

  Future<void> _reportSheet(Map<String, dynamic> profile) async {
    final reasons = [
      ['harassment', 'Harassment'],
      ['fake', 'Fake profile'],
      ['spam', 'Spam'],
      ['underage', 'Under 18'],
      ['other', 'Something else'],
    ];
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF161D2F),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(title: Text('Why are you reporting them?')),
            for (final item in reasons)
              ListTile(
                title: Text(item[1]),
                onTap: () => Navigator.pop(context, item[0]),
              ),
          ],
        ),
      ),
    );
    if (!mounted || reason == null) return;
    await _report(profile, reason);
  }

  Future<void> _block(Map<String, dynamic> profile) async {
    await _removePerson(profile, () => widget.api.postJson('/api/blocks', {
      'userId': profile['id'],
    }, token: widget.token));
  }

  Future<void> _report(Map<String, dynamic> profile, String reason) async {
    await _removePerson(profile, () => widget.api.postJson('/api/reports', {
      'reportedUserId': profile['id'],
      'reason': reason,
    }, token: widget.token));
  }

  Future<void> _removePerson(Map<String, dynamic> profile, Future<Map<String, dynamic>> Function() request) async {
    final id = profile['id']?.toString();
    setState(() {
      _busy = true;
      _error = '';
      _profiles = _profiles.where((item) => item['id']?.toString() != id).toList();
      _matches = _matches.where((item) => _other(item)['id']?.toString() != id).toList();
      if (_other(_openMatch ?? {})['id']?.toString() == id) _openMatch = null;
    });
    try {
      await request();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _profiles = [profile, ..._profiles];
        _error = error.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _deck() {
    if (_incomplete) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text('Add a photo', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('People only see you after your first photo. Choose one from your camera roll.'),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : () => _pickPhoto(ImageSource.gallery),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(52)),
            child: const Text('Choose from library'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _busy ? null : () => _pickPhoto(ImageSource.camera),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: const Text('Take a photo'),
          ),
        ],
      );
    }
    if (_profiles.isEmpty) {
      return const Center(child: Text("You're caught up. No new people in your deck."));
    }
    final card = _profiles.first;
    final photos = _mediaOf(card, widget.api.baseUrl);
    final cardId = card['id']?.toString() ?? '';
    final photoIndex = _cardId == cardId ? _cardPhoto.clamp(0, photos.isEmpty ? 0 : photos.length - 1) : 0;
    final photo = photos.isEmpty ? null : photos[photoIndex];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (photo != null)
                    photo.video ? _VideoCover(url: photo.url) : Image.network(photo.url, fit: BoxFit.cover)
                  else
                    const ColoredBox(color: Color(0xFF1A2236)),
                  if (photos.length > 1)
                    Positioned(
                      top: 10,
                      left: 12,
                      right: 56,
                      child: Row(
                        children: [
                          for (var index = 0; index < photos.length; index++)
                            Expanded(
                              child: Container(
                                height: 4,
                                margin: const EdgeInsets.symmetric(horizontal: 2),
                                decoration: BoxDecoration(
                                  color: index == photoIndex ? const Color(0xFFF4F1FF) : const Color(0x73FFFDF8),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  if (photos.length > 1) ...[
                    Positioned(
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 140,
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _cardId = cardId;
                          _cardPhoto = photoIndex == 0 ? 0 : photoIndex - 1;
                        }),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 140,
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _cardId = cardId;
                          _cardPhoto = photoIndex >= photos.length - 1 ? photoIndex : photoIndex + 1;
                        }),
                      ),
                    ),
                  ],
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black87],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 16,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_titleOf(card)}${card['verified'] == true ? ' · Verified' : ''}${card['videoVerified'] == true ? ' · Video' : ''}',
                          style: const TextStyle(color: Color(0xFFF4F1FF), fontSize: 28, fontWeight: FontWeight.w800),
                        ),
                        if (_subtitleOf(card).isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(_subtitleOf(card), style: const TextStyle(color: Color(0xFFF4F1FF))),
                          ),
                        if ((card['bio']?.toString() ?? '').isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              card['bio'].toString(),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Color(0xFFF4F1FF)),
                            ),
                          ),
                        if (_factsOf(card).isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                for (final fact in _factsOf(card))
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: const Color(0x8CFFFDF8)),
                                    ),
                                    child: Text(fact, style: const TextStyle(color: Color(0xFFF4F1FF), fontSize: 12)),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      onPressed: _busy ? null : () => _safetySheet(card),
                      icon: const Icon(Icons.more_horiz, color: Colors.white),
                      style: IconButton.styleFrom(backgroundColor: const Color(0x8C1C2B24)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_showPlus)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('mingleX Plus keeps this note off the deck.'),
            ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _round(Icons.close, () => _swipe('pass')),
              const SizedBox(width: 16),
              _round(Icons.star, () => _swipe('super'), filled: true),
              const SizedBox(width: 16),
              _round(Icons.favorite, () => _swipe('like'), filled: true),
            ],
          ),
          TextButton(onPressed: _busy ? null : _rewind, child: const Text('Rewind')),
          if (_locationRequired)
            TextButton(onPressed: _busy ? null : _shareLocation, child: const Text('Use my location')),
        ],
      ),
    );
  }

  Future<void> _answer(String userId, String direction) async {
    setState(() {
      _busy = true;
      _viewing = null;
    });
    try {
      final result = await widget.api.postJson('/api/swipes', {
        'toUserId': userId,
        'direction': direction,
      }, token: widget.token);
      final match = result['match'];
      if (!mounted) return;
      if (match is Map && match['pending'] != true) {
        showNote(context, 'You matched.');
      } else {
        showNote(context, direction == 'pass' ? 'Passed.' : 'Like sent.');
      }
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openRequest(String userId) async {
    setState(() => _busy = true);
    try {
      final result = await widget.api.postJson('/api/requests/$userId/thread', {}, token: widget.token);
      final match = result['match'];
      if (match is Map<String, dynamic>) _openChat(match);
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rewind() async {
    setState(() => _busy = true);
    try {
      final result = await widget.api.postJson('/api/swipes/rewind', {}, token: widget.token);
      final profile = result['profile'];
      if (profile is Map<String, dynamic> && mounted) {
        setState(() => _profiles = [profile, ..._profiles.where((item) => item['id'] != profile['id'])]);
      }
      if (mounted) showNote(context, 'Last swipe undone.');
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _boost() async {
    setState(() => _busy = true);
    try {
      await widget.api.postJson('/api/me/boost', {}, token: widget.token);
      if (mounted) showNote(context, "You're boosted for 30 minutes.");
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _unmatch() async {
    final match = _openMatch;
    if (match == null) return;
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(match['pending'] == true ? 'Cancel this chat?' : 'Leave this match?'),
        content: const Text('The chat is removed. Nobody is blocked.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Leave')),
        ],
      ),
    );
    if (leave != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await widget.api.deleteJson('/api/matches/${match['id']}', token: widget.token);
      if (!mounted) return;
      showNote(context, match['pending'] == true ? 'Request removed.' : 'You left the match.');
      _closeChat();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _matchList() {
    final people = _peopleTab == 'incoming' ? _incoming : _peopleTab == 'outgoing' ? _outgoing : _matches;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Wrap(
            spacing: 8,
            children: [
              ChoiceChip(label: const Text('Matches'), selected: _peopleTab == 'matches', onSelected: (_) => setState(() => _peopleTab = 'matches')),
              ChoiceChip(label: const Text('Requests'), selected: _peopleTab == 'incoming', onSelected: (_) => setState(() => _peopleTab = 'incoming')),
              ChoiceChip(label: const Text('Sent'), selected: _peopleTab == 'outgoing', onSelected: (_) => setState(() => _peopleTab = 'outgoing')),
            ],
          ),
        ),
        Expanded(
          child: _peopleTab == 'incoming' && _incomingLocked
              ? const Center(child: Text('See who likes you is a paid feature.'))
              : people.isEmpty
                  ? Center(child: Text(_peopleTab == 'matches'
                      ? 'When you both say yes, the match shows up here.'
                      : _peopleTab == 'incoming'
                          ? 'No one is waiting on your answer.'
                          : 'Likes you send show here until they answer.'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 0.72,
                      ),
                      itemCount: people.length,
                      itemBuilder: (context, index) {
                        final item = people[index];
                        final person = _peopleTab == 'matches' ? _other(item) : item;
                        final photo = _photoOf(person, widget.api.baseUrl);
                        final unread = item['unread'];
                        final caption = _peopleTab == 'outgoing'
                            ? '${_titleOf(person)} · Waiting'
                            : _peopleTab == 'incoming' && person['superLike'] == true
                                ? '${_titleOf(person)} · Super Like'
                                : _titleOf(person);
                        return InkWell(
                          onTap: () => setState(() {
                            _viewing = _peopleTab == 'matches' ? item : person;
                            _viewKind = _peopleTab;
                          }),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              color: const Color(0xFF161D2F),
                              image: photo == null ? null : DecorationImage(image: NetworkImage(photo), fit: BoxFit.cover),
                            ),
                            alignment: Alignment.bottomLeft,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(10, 28, 10, 10),
                              decoration: const BoxDecoration(
                                borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Color(0x00000000), Color(0xCC0C1410)],
                                ),
                              ),
                              child: Text(
                                unread is num && unread > 0 ? '$caption  ${unread.toInt()}' : caption,
                                style: const TextStyle(color: Color(0xFFF4F1FF), fontWeight: FontWeight.w800),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  Widget _personPage() {
    final opened = _viewing;
    if (opened == null) return const SizedBox.shrink();
    final person = _viewKind == 'matches' ? _other(opened) : opened;
    final photos = person['photos'] is List ? (person['photos'] as List).whereType<Map>().map((item) => item['url']?.toString() ?? '').where((url) => url.isNotEmpty).toList() : <String>[];
    final place = [
      person['city']?.toString() ?? '',
      person['distanceKm'] is num ? '${person['distanceKm']} km away' : '',
    ].where((item) => item.isNotEmpty).join(' · ');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: IconButton(onPressed: () => setState(() => _viewing = null), icon: const Icon(Icons.arrow_back)),
        ),
        if (photos.isEmpty)
          Container(height: 220, decoration: BoxDecoration(color: const Color(0xFF161D2F), borderRadius: BorderRadius.circular(18)))
        else
          ...photos.map((url) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.network(widget.api.mediaUrl(url), height: 280, width: double.infinity, fit: BoxFit.cover),
                ),
              )),
        Text(_titleOf(person), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text([person['jobTitle']?.toString() ?? '', place.isEmpty ? 'No city saved' : place, _genderLabel(person['gender']?.toString())].where((item) => item.isNotEmpty).join(' · ')),
        const SizedBox(height: 8),
        Text(
          (person['phone']?.toString().isNotEmpty ?? false) ? 'Phone ${person['phone']}' : 'No phone number on this profile',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        if ((person['bio']?.toString() ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(person['bio'].toString()),
        ],
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final fact in _factsOf(person)) Chip(label: Text(fact)),
          ],
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy
              ? null
              : () {
                  if (_viewKind == 'matches') {
                    if (_access['matchChat'] == false) {
                      showNote(context, 'Chat with matches is a paid feature.');
                      return;
                    }
                    _openChat(opened);
                    setState(() => _viewing = null);
                    return;
                  }
                  _openRequest(person['id'].toString());
                  setState(() => _viewing = null);
                },
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8)),
          child: const Text('Message'),
        ),
        if (_viewKind == 'incoming') ...[
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _busy ? null : () => _answer(person['id'].toString(), 'like'),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8)),
            child: const Text('Accept'),
          ),
          TextButton(onPressed: _busy ? null : () => _answer(person['id'].toString(), 'pass'), child: const Text('Pass')),
        ],
        if (_viewKind == 'outgoing')
          TextButton(onPressed: _busy ? null : () => _answer(person['id'].toString(), 'pass'), child: const Text('Cancel request')),
      ],
    );
  }

  Future<void> _saveProfile() async {
    final heightText = _height.text.trim();
    final heightCm = heightText.isEmpty ? null : int.tryParse(heightText);
    if (heightText.isNotEmpty && (heightCm == null || heightCm < 140 || heightCm > 220)) {
      showNote(context, 'Height should be between 140 and 220 cm.');
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.api.patchJson('/api/me', {
        'name': _name.text.trim(),
        'bio': _bio.text,
        'jobTitle': _job.text.trim(),
        'city': _city.text.trim(),
        'gender': _gender,
        'interestedIn': _interested,
        'interests': _hobbies,
        'lookingFor': _lookingFor.isEmpty ? null : _lookingFor,
        'drinking': _drinking.isEmpty ? null : _drinking,
        'smoking': _smoking.isEmpty ? null : _smoking,
        'workout': _workout.isEmpty ? null : _workout,
        'pets': _pets.isEmpty ? null : _pets,
        'education': _education.isEmpty ? null : _education,
        'kids': _kids.isEmpty ? null : _kids,
        'heightCm': heightCm,
      }, token: widget.token);
      if (!mounted) return;
      showNote(context, 'Profile saved.');
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _myProfile() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('My profile', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (_photos.isEmpty)
          Container(height: 180, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFF161D2F), borderRadius: BorderRadius.circular(18)), child: const Text('Add a photo', style: TextStyle(color: Color(0xFFF4F1FF))))
        else
          ..._photos.map((photo) {
            final url = photo['url']?.toString() ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      height: 220,
                      width: double.infinity,
                      child: photo['kind'] == 'video' ? _VideoCover(url: widget.api.mediaUrl(url)) : Image.network(widget.api.mediaUrl(url), fit: BoxFit.cover),
                    ),
                  ),
                  Row(
                    children: [
                      TextButton(onPressed: _busy ? null : () => _makeMain(url), child: Text(photo['isPrimary'] == true ? 'Main' : 'Make main')),
                      TextButton(onPressed: _busy ? null : () => _removePhoto(url), child: const Text('Remove')),
                    ],
                  ),
                ],
              ),
            );
          }),
        OutlinedButton(
          onPressed: _busy || _photos.where((photo) => photo['kind'] != 'video').length >= 6 ? null : () => _pickPhoto(ImageSource.gallery),
          child: const Text('Add photo'),
        ),
        OutlinedButton(
          onPressed: _busy || _photos.any((photo) => photo['kind'] == 'video') ? null : () => _pickVideo(ImageSource.gallery, '/api/me/photos'),
          child: const Text('Add video'),
        ),
        const SizedBox(height: 8),
        Text('Verify it is you. Photo: $_photoCheck. Video: $_videoCheck. A person on the team reviews these before the badge appears.'),
        OutlinedButton(onPressed: _busy ? null : _pickCheckPhoto, child: const Text('Photo check')),
        OutlinedButton(onPressed: _busy ? null : () => _pickVideo(ImageSource.camera, '/api/me/verification/video'), child: const Text('Video check')),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
        TextField(controller: _job, decoration: const InputDecoration(labelText: 'Job')),
        TextField(controller: _city, decoration: const InputDecoration(labelText: 'City')),
        TextField(controller: _bio, maxLines: 4, decoration: const InputDecoration(labelText: 'Bio')),
        const SizedBox(height: 8),
        const Text('I am', style: TextStyle(fontWeight: FontWeight.w700)),
        Wrap(
          spacing: 8,
          children: [
            for (final item in const [('woman', 'Woman'), ('man', 'Man'), ('nonbinary', 'Nonbinary')])
              ChoiceChip(label: Text(item.$2), selected: _gender == item.$1, onSelected: (_) => setState(() => _gender = item.$1)),
          ],
        ),
        const SizedBox(height: 8),
        _choiceRow('Looking for', _lookingFor, const [('relationship', 'A relationship'), ('casual', 'Something casual'), ('friends', 'New friends'), ('not_sure', 'Not sure yet')], (value) => setState(() => _lookingFor = value)),
        _choiceRow('Drinking', _drinking, const [('never', 'Never'), ('socially', 'Socially'), ('often', 'Regularly')], (value) => setState(() => _drinking = value)),
        _choiceRow('Smoking', _smoking, const [('never', 'Never'), ('socially', 'Socially'), ('often', 'Regularly')], (value) => setState(() => _smoking = value)),
        _choiceRow('Workout', _workout, const [('never', 'Never'), ('sometimes', 'Sometimes'), ('often', 'Often')], (value) => setState(() => _workout = value)),
        _choiceRow('Pets', _pets, const [('dog', 'Dog'), ('cat', 'Cat'), ('both', 'Dog and cat'), ('none', 'No pets'), ('other', 'Other pets')], (value) => setState(() => _pets = value)),
        _choiceRow('Education', _education, const [('high_school', 'High school'), ('college', 'College'), ('grad', 'Graduate school')], (value) => setState(() => _education = value)),
        _choiceRow('Kids', _kids, const [('want', 'Want someday'), ('have', 'Have kids'), ('dont_want', "Don't want"), ('not_sure', 'Not sure')], (value) => setState(() => _kids = value)),
        TextField(controller: _height, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Height in cm')),
        const SizedBox(height: 8),
        const Text('Hobbies', style: TextStyle(fontWeight: FontWeight.w700)),
        Wrap(
          spacing: 8,
          children: [
            for (final hobby in const ['Hiking', 'Cooking', 'Travel', 'Music', 'Movies', 'Reading', 'Gym', 'Yoga', 'Art', 'Gaming', 'Dancing', 'Photography', 'Coffee', 'Outdoors', 'Sports', 'Plants', 'Markets', 'Walking'])
              FilterChip(
                label: Text(hobby),
                selected: _hobbies.contains(hobby),
                onSelected: (selected) => setState(() {
                  if (selected && _hobbies.length < 8) _hobbies = [..._hobbies, hobby];
                  if (!selected) _hobbies = _hobbies.where((item) => item != hobby).toList();
                }),
              ),
          ],
        ),
        const SizedBox(height: 12),
        FilledButton(onPressed: _busy ? null : _saveProfile, style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8)), child: const Text('Save profile')),
        const SizedBox(height: 16),
        Text('Phone: ${_phone.isEmpty ? 'None' : _phone}'),
        Text('Email: ${_email.isEmpty ? 'None' : _email}'),
        if (_phone.isNotEmpty) TextButton(onPressed: _busy ? null : _removePhone, child: const Text('Remove phone')),
        TextField(controller: _phoneNational, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'New number, like +15551234567')),
        OutlinedButton(onPressed: _busy ? null : _sendPhone, child: const Text('Send code')),
        if (_phoneSent) ...[
          TextField(controller: _phoneCode, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '6-digit code')),
          FilledButton(onPressed: _busy ? null : _verifyPhone, style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8)), child: const Text('Save number')),
        ],
      ],
    );
  }

  Widget _choiceRow(String label, String selected, List<(String, String)> options, ValueChanged<String> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        Wrap(
          spacing: 8,
          children: [
            for (final option in options)
              ChoiceChip(
                label: Text(option.$2),
                selected: selected == option.$1,
                onSelected: (_) => onChanged(selected == option.$1 ? '' : option.$1),
              ),
          ],
        ),
      ],
    );
  }

  Future<void> _makeMain(String url) async {
    setState(() => _busy = true);
    try {
      await widget.api.patchJson('/api/me', {
        'photos': _photos.map((photo) => {'url': photo['url'], 'isPrimary': photo['url'] == url}).toList(),
      }, token: widget.token);
      if (mounted) showNote(context, 'Main photo updated.');
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _removePhoto(String url) async {
    setState(() => _busy = true);
    try {
      await widget.api.deleteJson('/api/me/photos', token: widget.token, body: {'url': url});
      if (mounted) showNote(context, 'Photo removed.');
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _attachPhone(PhoneAuthCredential credential) async {
    final signedIn = await FirebaseAuth.instance.signInWithCredential(credential);
    final idToken = await signedIn.user?.getIdToken();
    if (idToken == null) throw ApiException('Phone verification did not go through');
    await widget.api.postJson('/api/me/phone/firebase', {'idToken': idToken}, token: widget.token);
    if (!mounted) return;
    setState(() {
      _phoneSent = false;
      _phoneCode.clear();
      _phoneNational.clear();
    });
    showNote(context, 'Phone number saved.');
    await _refresh();
  }

  Future<void> _sendPhone() async {
    if (!firebaseReady) {
      showNote(context, 'Phone verification is not ready on this device.');
      return;
    }
    final phone = _phoneNational.text.trim();
    setState(() => _busy = true);
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (credential) {
          _runPhone(() => _attachPhone(credential));
        },
        verificationFailed: (error) {
          if (mounted) showNote(context, error.message ?? 'Could not send the code');
        },
        codeSent: (verificationId, _) {
          if (!mounted) return;
          setState(() {
            _profileVerificationId = verificationId;
            _phoneSent = true;
          });
          showNote(context, 'Code sent to your number.');
        },
        codeAutoRetrievalTimeout: (_) {},
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runPhone(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } on FirebaseAuthException catch (error) {
      if (mounted) showNote(context, error.message ?? 'That code is not right');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyPhone() async {
    final verificationId = _profileVerificationId;
    if (verificationId == null) {
      showNote(context, 'Send the code to your number first');
      return;
    }
    await _runPhone(() => _attachPhone(PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: _phoneCode.text.trim(),
    )));
  }

  Future<void> _removePhone() async {
    setState(() => _busy = true);
    try {
      await widget.api.deleteJson('/api/me/phone', token: widget.token);
      if (mounted) showNote(context, 'Phone number removed.');
      await _refresh();
    } on ApiException catch (error) {
      if (mounted) showNote(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool _messageWasSeen(List<Map<String, dynamic>> messages, String? otherId) {
    if (messages.isEmpty) return false;
    final last = messages.last;
    final sender = last['senderId']?.toString();
    return sender != null && sender != otherId && last['readAt'] != null;
  }

  Widget _chat() {
    final match = _openMatch;
    if (match == null) return const SizedBox.shrink();
    final otherId = _other(match)['id']?.toString();
    return Column(
      children: [
        Row(
          children: [
            IconButton(onPressed: _closeChat, icon: const Icon(Icons.arrow_back)),
            Text(_titleOf(_other(match)), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const Spacer(),
            TextButton(onPressed: _unmatch, child: Text(match['pending'] == true ? 'Cancel' : 'Unmatch')),
            TextButton(onPressed: () => _safetySheet(_other(match)), child: const Text('Report')),
          ],
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final message in _messages)
                Align(
                  alignment: message['senderId']?.toString() == otherId ? Alignment.centerLeft : Alignment.centerRight,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: message['senderId']?.toString() == otherId ? const Color(0xFF1A2236) : const Color(0xFFE84AA8),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      message['text']?.toString() ?? '',
                      style: TextStyle(
                        color: message['senderId']?.toString() == otherId
                            ? const Color(0xFFF4F1FF)
                            : const Color(0xFFF4F1FF),
                      ),
                    ),
                  ),
                ),
              if (_messageWasSeen(_messages, otherId))
                const Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: EdgeInsets.only(top: 2, right: 4),
                    child: Text('Seen', style: TextStyle(color: Color(0xFF5C675F), fontWeight: FontWeight.w700)),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(child: TextField(controller: _draft, decoration: const InputDecoration(hintText: 'Message'))),
              IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _matchOverlay() {
    final other = _other(_celebration ?? {});
    return ColoredBox(
      color: const Color(0xF6F3EEE4),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text("It's a match", style: TextStyle(color: Color(0xFFE84AA8), fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text('You and ${other['name'] ?? 'them'} liked each other.', textAlign: TextAlign.center, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            TextField(controller: _hello, decoration: const InputDecoration(hintText: 'Say hello')),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _sendHello,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE84AA8), minimumSize: const Size.fromHeight(48)),
              child: const Text('Send'),
            ),
            TextButton(
              onPressed: () => setState(() => _celebration = null),
              child: const Text('Keep swiping'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _round(IconData icon, VoidCallback onPressed, {bool filled = false}) {
    return IconButton.filled(
      onPressed: _busy ? null : onPressed,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        backgroundColor: filled ? const Color(0xFFE84AA8) : const Color(0xFFF4F1FF),
        foregroundColor: filled ? const Color(0xFFF4F1FF) : const Color(0xFFF4F1FF),
        side: filled ? null : const BorderSide(color: Color(0xFF6B7280), width: 2),
        fixedSize: const Size(68, 68),
      ),
    );
  }
}

List<Map<String, dynamic>> _asList(Object? value) {
  if (value is! List) return [];
  return value.whereType<Map<String, dynamic>>().toList();
}

Map<String, dynamic> _other(Map<String, dynamic> match) {
  final other = match['otherUser'];
  return other is Map<String, dynamic> ? other : {};
}

String? _photoOf(Map<String, dynamic> profile, String baseUrl) {
  final media = _mediaOf(profile, baseUrl);
  final still = media.where((item) => !item.video);
  if (still.isNotEmpty) return still.first.url;
  return media.isEmpty ? null : media.first.url;
}

List<({String url, bool video})> _mediaOf(Map<String, dynamic> profile, String baseUrl) {
  final photos = profile['photos'];
  if (photos is! List) return [];
  final ordered = photos.whereType<Map>().toList()
    ..sort((left, right) => (right['isPrimary'] == true ? 1 : 0).compareTo(left['isPrimary'] == true ? 1 : 0));
  return ordered.map((photo) {
    final raw = photo['url']?.toString() ?? '';
    if (raw.isEmpty) return null;
    final url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : '$baseUrl$raw';
    return (url: url, video: photo['kind'] == 'video');
  }).whereType<({String url, bool video})>().toList();
}

class _VideoCover extends StatefulWidget {
  const _VideoCover({required this.url});

  final String url;

  @override
  State<_VideoCover> createState() => _VideoCoverState();
}

class _VideoCoverState extends State<_VideoCover> {
  late final VideoPlayerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..setLooping(true)
      ..setVolume(0)
      ..initialize().then((_) {
        if (!mounted) return;
        setState(() {});
        _controller.play();
      }).catchError((_) {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_controller.value.isInitialized) {
      return const ColoredBox(
        color: Color(0xFFF4F1FF),
        child: Center(child: Text('Video', style: TextStyle(color: Color(0xFFF4F1FF), fontWeight: FontWeight.w700))),
      );
    }
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: _controller.value.size.width,
        height: _controller.value.size.height,
        child: VideoPlayer(_controller),
      ),
    );
  }
}

String _titleOf(Map<String, dynamic> profile) {
  final name = profile['name']?.toString() ?? 'Someone';
  final age = profile['age'];
  return age is num ? '$name, ${age.toInt()}' : name;
}

String _genderLabel(String? gender) {
  return switch (gender) {
    'woman' => 'Woman',
    'man' => 'Man',
    'nonbinary' => 'Nonbinary',
    _ => '',
  };
}

String _subtitleOf(Map<String, dynamic> profile) {
  final parts = <String>[];
  final job = profile['jobTitle']?.toString() ?? '';
  final city = profile['city']?.toString() ?? '';
  if (job.isNotEmpty) parts.add(job);
  if (city.isNotEmpty) parts.add(city);
  final distance = profile['distanceKm'];
  if (distance is num) parts.add('$distance km away');
  return parts.join(' · ');
}

const _hobbyChoices = [
  'Hiking', 'Cooking', 'Travel', 'Music', 'Movies', 'Reading', 'Gym', 'Yoga',
  'Art', 'Gaming', 'Dancing', 'Photography', 'Coffee', 'Outdoors', 'Sports',
  'Plants', 'Markets', 'Walking',
];

const _lookingForChoices = [
  ['relationship', 'A relationship'],
  ['casual', 'Something casual'],
  ['friends', 'New friends'],
  ['not_sure', 'Not sure yet'],
];

const _drinkingChoices = [
  ['never', 'Never'],
  ['socially', 'Socially'],
  ['often', 'Regularly'],
];

const _smokingChoices = [
  ['never', 'Never'],
  ['socially', 'Socially'],
  ['often', 'Regularly'],
];

const _workoutChoices = [
  ['never', 'Never'],
  ['sometimes', 'Sometimes'],
  ['often', 'Often'],
];

const _petsChoices = [
  ['dog', 'Dog'],
  ['cat', 'Cat'],
  ['both', 'Dog and cat'],
  ['none', 'No pets'],
  ['other', 'Other pets'],
];

const _kidsChoices = [
  ['want', 'Want someday'],
  ['have', 'Have kids'],
  ['dont_want', "Don't want"],
  ['not_sure', 'Not sure'],
];

const _educationChoices = [
  ['high_school', 'High school'],
  ['college', 'College'],
  ['grad', 'Graduate school'],
];

const _factLabels = {
  'lookingFor': {'relationship': 'Relationship', 'casual': 'Casual', 'friends': 'New friends', 'not_sure': 'Figuring it out'},
  'drinking': {'never': "Doesn't drink", 'socially': 'Drinks socially', 'often': 'Drinks often'},
  'smoking': {'never': "Doesn't smoke", 'socially': 'Smokes socially', 'often': 'Smokes often'},
  'workout': {'never': 'No workouts', 'sometimes': 'Works out sometimes', 'often': 'Works out often'},
  'pets': {'dog': 'Dog', 'cat': 'Cat', 'both': 'Dog and cat', 'none': 'No pets', 'other': 'Other pets'},
  'education': {'high_school': 'High school', 'college': 'College', 'grad': 'Graduate school'},
  'kids': {'want': 'Wants kids', 'have': 'Has kids', 'dont_want': "Doesn't want kids", 'not_sure': 'Kids, not sure'},
};

List<String> _factsOf(Map<String, dynamic> profile) {
  final facts = <String>[];
  for (final entry in _factLabels.entries) {
    final label = entry.value[profile[entry.key]?.toString()];
    if (label != null) facts.add(label);
  }
  final height = profile['heightCm'];
  if (height is num) facts.add('${height.toInt()} cm');
  final interests = profile['interests'];
  if (interests is List) {
    for (final item in interests) {
      final text = item.toString();
      if (text.isNotEmpty) facts.add(text);
    }
  }
  return facts;
}
