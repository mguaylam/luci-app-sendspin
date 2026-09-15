'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

/* `sendspin-cli status` prints one "key: value" line per field */
function parseStatus(output) {
	const info = {};

	for (const line of (output ?? '').split('\n')) {
		const sep = line.indexOf(': ');

		if (sep > 0)
			info[line.substring(0, sep)] = line.substring(sep + 2);
	}

	return info;
}

return baseclass.extend({
	/*
	 * Resolves to one entry per player section: whether it is enabled and
	 * running, and what the running player reports about itself.
	 */
	getPlayers() {
		return Promise.all([
			L.resolveDefault(callServiceList('sendspin-cli'), {}),
			uci.load('sendspin-cli')
		]).then(([ services ]) => {
			const instances = services?.['sendspin-cli']?.instances ?? {};

			return Promise.all(uci.sections('sendspin-cli', 'player').map((s) => {
				const player = {
					id: s['.name'],
					name: s.name,
					enabled: s.enabled == '1',
					running: instances[s['.name']]?.running == true,
					info: null
				};

				if (!player.running)
					return player;

				return L.resolveDefault(fs.exec('/usr/bin/sendspin-cli', [
					'status', '--control-socket', `/var/run/sendspin-cli/${player.id}.sock`
				]), null).then((res) => {
					if (res?.code == 0)
						player.info = parseStatus(res.stdout);

					return player;
				});
			}));
		});
	},

	/* Label and value rows describing one player, for status tables */
	describe(player) {
		if (!player.enabled)
			return [ [ _('Player'), _('Disabled') ] ];

		if (!player.running)
			return [ [ _('Player'), _('Not running') ] ];

		if (!player.info)
			return [ [ _('Player'), _('Running, status unavailable') ] ];

		const info = player.info;
		const rows = [
			[ _('Name'), info.name ],
			[ _('Server'), info.server ],
			[ _('State'), info.state ],
			[ _('Track'), info.track ],
			[ _('Volume'), info['player volume'] ],
			[ _('Output'), info.output ]
		];

		return rows.filter((row) => row[1] != null && row[1] !== '');
	},

	/*
	 * Playback devices from /proc/asound, as [ "hw:card,device", label ]
	 * pairs; a hw: device is played without resampling.
	 */
	getPlaybackDevices() {
		return Promise.all([
			L.resolveDefault(fs.read('/proc/asound/cards'), ''),
			L.resolveDefault(fs.read('/proc/asound/pcm'), '')
		]).then(([ cards, pcms ]) => {
			const cardNames = {};

			/* each card is two lines, the second its long name: "Yichip USB-Audio at usb-..., full speed" */
			for (const m of cards.matchAll(/^\s*(\d+)\s+\[[^\]]*\]:.*\n\s+(.+)$/gm))
				cardNames[+m[1]] = m[2].replace(/ at .*$/, '').trim();

			const devices = [];

			for (const m of pcms.matchAll(/^(\d+)-(\d+):\s*([^:]*?)\s*:.*playback/gm)) {
				const card = +m[1], device = +m[2];
				const card_name = cardNames[card] ?? _('Card %d').format(card);

				devices.push([ `hw:${card},${device}`, `hw:${card},${device} (${card_name}, ${m[3]})` ]);
			}

			return devices;
		});
	}
});
