'use strict';
'require baseclass';
'require sendspin';

return baseclass.extend({
	title: _('Sendspin'),

	load() {
		return sendspin.getPlayers();
	},

	render(players) {
		if (!players.length)
			return null;

		return E('table', { 'class': 'table' }, players.flatMap((player) =>
			sendspin.describe(player).map(([ label, value ]) => E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, label),
				E('td', { 'class': 'td left' }, value)
			]))
		));
	}
});
