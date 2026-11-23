import { DocPage } from '@/components/DocPage';

export default function Rules() {
  return (
    <DocPage title="Community rules" updated="22 November 2026" sections={[
      { heading: 'Cheer loud, play fair', body: [
        'Stands is a crowd. Rivalry and banter are welcome; abuse is not.',
      ] },
      { heading: 'Not allowed', body: [
        'Harassment, threats, or bullying of anyone: fans, players, officials, or staff.',
        'Hate speech or slurs about race, ethnicity, nationality, religion, gender, sexuality, or disability.',
        'Sexual content, graphic violence, or anything illegal.',
        'Spam, scams, links to gambling sites, or selling anything.',
        'Pretending to be someone else, including athletes, teams, or Stands staff.',
        'Sharing anyone’s private information.',
      ] },
      { heading: 'Free points only', body: [
        'Clout and Tix are free play points. They have no cash value and can never be bought, sold, traded for money, or cashed out.',
        'Calls are predictions for fun. Stands has no real-money gambling of any kind.',
        'Stand Cards have no cash value. Quick sell turns a card back into a few Tix inside Stands, never into money, and every pack shows its odds before you open it.',
      ] },
      { heading: 'Tools you have', body: [
        'Report: press and hold any message (or tap •••) and choose Report. We hide it for you right away.',
        'Block: blocking someone hides all of their messages from you.',
        'Our word filter stops the most extreme racial slurs before they are posted. Report and Block handle everything else.',
      ] },
      { heading: 'What happens if you break the rules', body: [
        'Messages that break these rules are removed. Repeated or serious breaks lead to a mute or a permanent ban.',
      ] },
    ]} />
  );
}
