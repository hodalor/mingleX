import 'package:flutter_test/flutter_test.dart';
import 'package:minglex/main.dart';

void main() {
  testWidgets('Get Started offers every sign-in method', (WidgetTester tester) async {
    await tester.pumpWidget(const MinglexApp());

    expect(find.text('Get Started'), findsOneWidget);
    expect(find.text('Log in with email'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Continue with Apple'), findsOneWidget);
    expect(find.text('Log in with phone number'), findsOneWidget);
    expect(find.textContaining('18'), findsOneWidget);
  });
}
