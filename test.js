import qs from 'qs';

const timestamp = Date.now();
const data = new Map([
    ['types', { user: 0, matchs: 1, match: 0, home: 0, comments: 0, device: 'desktop' }],
    ['timers', { ft_news: timestamp.toString(), ft_bet: timestamp.toString(), ft_players: timestamp.toString() }],
]);

const datao = Object.fromEntries(data); 
const dataqs = qs.stringify(datao);

console.log(data);
console.log(datao);
console.log(dataqs);

