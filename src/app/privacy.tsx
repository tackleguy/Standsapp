import { DocPage } from '@/components/DocPage';

export default function Privacy() {
  return (
    <DocPage title="Privacy policy" updated="22 November 2026" sections={[
      { heading: 'The short version', body: [
        'Stands collects as little as possible: a username, a display name, your birth year, and (only if you choose) an email address.',
        'We never sell your data. There are no ads and no trackers in Stands.',
      ] },
      { heading: 'What we collect and why', body: [
        'Username and display name: so other fans can see who is chatting and who is top of the leaderboard.',
        'Birth year: only to confirm you are 13 or older. We never ask for your full date of birth.',
        'Email (optional): to sign in on a new phone once accounts move to our servers.',
        'What you do in the app (Calls, cards, ratings, messages, Sections): so the app can show your history, settle your Calls, and run leaderboards.',
      ] },
      { heading: 'Where it is stored', body: [
        'Right now Stands is in demo mode: your profile and activity are stored only on this device. Nothing is sent to a server.',
        'When Stands connects to its database, your data will be stored securely with our hosting provider, and this policy will be updated before that happens.',
      ] },
      { heading: 'Your choices', body: [
        'You can browse as a guest without giving us anything.',
        'You can delete your account at any time from Settings. This erases your profile and everything attached to it.',
        'You can block anyone and report any message.',
      ] },
      { heading: 'Children', body: ['Stands is for fans aged 13 and over. If we learn that someone under 13 has an account, we delete it.'] },
      { heading: 'Contact', body: ['Questions about privacy? Contact the Stands team through the support address listed on our store page.'] },
    ]} />
  );
}
