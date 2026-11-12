'use strict';
'require view';
'require form';
'require poll';
'require ui';
'require sendspin';

/* Pairing tokens shown on request, kept across refreshes */
const tokens = {};

function copyText(text) {
	/* the clipboard API needs HTTPS, which LuCI often is not served over */
	if (navigator.clipboard && window.isSecureContext)
		return navigator.clipboard.writeText(text);

	const field = E('textarea', { 'style': 'position: fixed; opacity: 0' }, text);

	document.body.appendChild(field);
	field.select();
	document.execCommand('copy');
	field.remove();

	return Promise.resolve();
}

function copyButton(text) {
	return E('button', {
		'class': 'cbi-button cbi-button-action',
		'click': (ev) => copyText(text).then(() => {
			ev.target.textContent = _('Copied');
			window.setTimeout(() => ev.target.textContent = _('Copy'), 2000);
		})
	}, _('Copy'));
}

/* A value and the buttons acting on it, centred on one line */
function withButtons(value, ...buttons) {
	return E('div', { 'style': 'display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap' }, [ value, ...buttons ]);
}

function describedValue(value, description) {
	return E('div', {}, [ value, E('div', { 'class': 'cbi-value-description' }, description) ]);
}

/* Label and value rows saying where pairing stands for a running player */
function renderPairing(player, refresh) {
	const info = player.info;
	const server = info.server?.replace(/ \(connected\)$/, '');
	const rows = [];

	const notify = (err) => ui.addNotification(null, E('p', {}, _('The player refused the command: %s').format(err.message)), 'error');
	const send = (command, arg) => sendspin.control(player.id, command, arg).catch(notify).then(refresh);

	if (info['pairing code']) {
		rows.push([ _('State'), _('Pairing in progress') ]);
		rows.push([ _('Pairing code'), describedValue(withButtons(
			E('strong', { 'style': 'font-family: monospace; font-size: 1.5em' }, info['pairing code']),
			copyButton(info['pairing code'])
		), _('Enter this code in the server to complete pairing.')) ]);
	}
	else if (info['pairing window'] != null) {
		rows.push([ _('State'), describedValue(E('div', {}, [
			E('button', {
				'class': 'cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(null, () => send('pair', 'confirm'))
			}, _('Approve')), ' ',
			E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(null, () => send('pair', 'cancel'))
			}, _('Reject'))
		]), _('A server is requesting to pair with this player.')) ]);
	}
	else if (info.trust == 'paired') {
		rows.push([ _('State'), _('Paired with %s').format(server) ]);
	}
	else {
		rows.push([ _('State'), describedValue(
			info.trust == 'unpaired' ? _('Not paired') : _('No server connected'),
			_('To pair, add this player in the server. The pairing code is displayed here when the server requests it.')) ]);
	}

	let token;

	if (tokens[player.id] == null) {
		token = E('button', {
			'class': 'cbi-button cbi-button-action',
			'click': ui.createHandlerFn(null, () => sendspin.getPairingToken(player.id)
				.then((value) => tokens[player.id] = value)
				.catch(notify)
				.then(refresh))
		}, _('Show'));
	}
	else {
		const field = E('input', {
			'class': 'cbi-input-text',
			'readonly': true,
			'value': tokens[player.id],
			'click': (ev) => ev.target.select()
		});

		token = withButtons(field, copyButton(tokens[player.id]));
	}

	rows.push([ _('Pairing token'), describedValue(token,
		_('Alternative to the pairing code, for servers that accept a pairing token. Treat it as a password.')) ]);

	return rows;
}

/*
 * Opens a dialog when a pairing attempt needs the operator, and closes it
 * when the attempt ends. A dialog the operator closed stays closed for that
 * attempt.
 */
let pairingDialog = null;
const dismissedDialogs = new Set();

function updatePairingDialog(players, refresh) {
	const player = players.find((p) => p.info?.['pairing code'] || p.info?.['pairing window'] != null);
	const info = player?.info;
	const key = player ? `${player.id}:${info['pairing code'] ?? 'window'}` : null;

	if (key == pairingDialog)
		return;

	if (pairingDialog != null && !dismissedDialogs.has(pairingDialog))
		ui.hideModal();

	pairingDialog = key;

	if (key == null || dismissedDialogs.has(key))
		return;

	const server = info.server?.endsWith(' (connected)') ? info.server.replace(/ \(connected\)$/, '') : null;
	const close = () => {
		dismissedDialogs.add(key);
		ui.hideModal();
	};
	const send = (command) => sendspin.control(player.id, 'pair', command)
		.catch((err) => ui.addNotification(null, E('p', {}, _('The player refused the command: %s').format(err.message)), 'error'))
		.then(close)
		.then(refresh);

	const body = [
		E('p', {}, server
			? _('%s is requesting to pair with this player.').format(server)
			: _('A server is requesting to pair with this player.'))
	];

	if (info['pairing code']) {
		body.push(
			E('p', {}, withButtons(
				E('span', {}, [ _('Pairing code'), ': ' ]),
				E('strong', { 'style': 'font-family: monospace; font-size: 1.5em' }, info['pairing code']),
				copyButton(info['pairing code'])
			)),
			E('p', {}, _('Enter this code in the server to complete pairing.')),
			E('div', { 'class': 'right' }, E('button', { 'class': 'btn cbi-button', 'click': close }, _('Close'))));
	}
	else {
		body.push(E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(null, () => send('cancel')) }, _('Reject')), ' ',
			E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': ui.createHandlerFn(null, () => send('confirm')) }, _('Approve'))
		]));
	}

	ui.showModal(_('Pairing'), body);
}

function renderTable(rows) {
	return E('table', { 'class': 'table' }, rows.map(([ label, value ]) => E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'width': '33%' }, label),
		E('td', { 'class': 'td left' }, value)
	])));
}

function renderPairingSection(players, refresh) {
	const running = players.filter((player) => player.info);

	if (!running.length)
		return E('em', {}, _('Not running'));

	return E('div', {}, running.map((player) => E('div', {}, [
		running.length > 1 ? E('h4', {}, player.info.name || player.id) : '',
		renderTable(renderPairing(player, refresh))
	])));
}

/* Playback and group controls for a player connected to a server */
function renderControls(player, refresh) {
	const info = player.info;
	const group = sendspin.parseVolume(info['group volume']);
	const playing = info.state?.startsWith('playing');

	const send = (command, arg) => sendspin.control(player.id, command, arg)
		.catch((err) => ui.addNotification(null, E('p', {}, _('The player refused the command: %s').format(err.message)), 'error'))
		.then(refresh);

	const button = (label, command, arg) => E('button', {
		'class': 'cbi-button cbi-button-action',
		'click': ui.createHandlerFn(null, () => send(command, arg))
	}, label);

	const rows = [
		[ _('Playback'), E('div', {}, [
			button(_('Previous'), 'prev'), ' ',
			playing ? button(_('Pause'), 'pause') : button(_('Play'), 'play'), ' ',
			button(_('Stop'), 'stop'), ' ',
			button(_('Next'), 'next')
		]) ]
	];

	if (group) {
		const value = E('span', {}, ` ${group.volume} `);

		rows.push([ _('Group volume'), E('div', {}, [
			E('input', {
				'type': 'range', 'min': 0, 'max': 100, 'step': 1, 'value': group.volume,
				'input': (ev) => value.textContent = ` ${ev.target.value} `,
				'change': (ev) => send('vol', ev.target.value)
			}),
			value,
			button(group.muted ? _('Unmute') : _('Mute'), 'mute', group.muted ? 'off' : 'on')
		]) ]);
	}

	if ([ 'off', 'one', 'all' ].includes(info.repeat)) {
		rows.push([ _('Repeat'), E('select', {
			'class': 'cbi-input-select',
			'change': (ev) => send('repeat', ev.target.value)
		}, [
			E('option', { 'value': 'off', 'selected': info.repeat == 'off' || null }, _('Off')),
			E('option', { 'value': 'one', 'selected': info.repeat == 'one' || null }, _('One track')),
			E('option', { 'value': 'all', 'selected': info.repeat == 'all' || null }, _('All'))
		]) ]);
	}

	if ([ 'on', 'off' ].includes(info.shuffle)) {
		rows.push([ _('Shuffle'), E('input', {
			'type': 'checkbox',
			'checked': info.shuffle == 'on' || null,
			'change': (ev) => send('shuffle', ev.target.checked ? 'on' : 'off')
		}) ]);
	}

	return rows;
}

function renderStatus(players, refresh) {
	if (!players.length)
		return E('em', {}, _('No player is configured.'));

	return E('div', {}, players.map((player) => {
		const rows = sendspin.describe(player);

		if (player.info?.server?.endsWith('(connected)'))
			rows.push(...renderControls(player, refresh));

		return renderTable(rows);
	}));
}

return view.extend({
	load() {
		return Promise.all([
			sendspin.getPlayers(),
			sendspin.getPlaybackDevices(),
			sendspin.getCaptureDevices()
		]);
	},

	render([ players, devices, captureDevices ]) {
		let m, s, o;

		m = new form.Map('sendspin-cli', _('Sendspin'),
			_('Sendspin player: plays synchronized audio from a Sendspin server, such as Music Assistant, through a sound card connected to this device.'));

		s = m.section(form.TypedSection, 'player', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'name', _('Name'),
			_('Name the server shows for this player. Defaults to the host name.'));

		o = s.taboption('general', form.Value, 'device', _('Output device'),
			_('ALSA device to play through. A <code>hw:</code> device plays without resampling.'));
		o.placeholder = 'hw:0,0';
		for (const [ value, label ] of devices)
			o.value(value, label);

		o = s.taboption('general', form.Value, 'input', _('Input device'),
			_('ALSA device to capture from, such as a line-in or a microphone, and stream to the server. Only a paired server can use it, as a Live Input in Music Assistant. A card missing at startup costs only the input: the player plays without it and restarts with it once the card appears. Empty captures nothing.'));
		o.placeholder = _('None');
		for (const [ value, label ] of captureDevices)
			o.value(value, label);
		o.value('tone', _('Test tone (440 Hz)'));

		o = s.taboption('general', form.Value, 'audio_format', _('Preferred formats'),
			_('Formats offered to the server first, as a comma-separated list of <code>codec:rate:depth:channels</code>, e.g. <code>flac:48000:16:2,pcm:48000:16:2</code>. The device\'s other formats stay behind them, so this is a preference the server can fall back from, not a restriction. Empty offers every format the device accepts.'));
		o.validate = function(section_id, value) {
			if (!value)
				return true;

			for (const entry of value.split(',')) {
				const m = /^(flac|opus|pcm):(\d+):(\d+):(\d+)$/.exec(entry.trim());

				if (!m)
					return _('Expected a comma-separated list of codec:rate:depth:channels, with codec flac, opus or pcm');

				/* the player refuses to start on any other opus format */
				if (m[1] == 'opus' && (m[2] != '48000' || m[3] != '16' || +m[4] > 2))
					return _('opus is only accepted at 48000:16 with at most 2 channels');
			}

			return true;
		};

		o = s.taboption('advanced', form.Value, 'buffer_ms', _('Buffer'),
			_('Audio kept buffered by the device, in milliseconds.'));
		o.datatype = 'range(10,2000)';
		o.placeholder = '100';

		o = s.taboption('advanced', form.Value, 'output_delay', _('Output delay'),
			_('Latency added after the device, such as by an amplifier, in milliseconds. Only a first-run default: a delay set from the server is remembered.'));
		o.datatype = 'uinteger';
		o.placeholder = '0';

		o = s.taboption('advanced', form.Value, 'port', _('Port'),
			_('Port the player listens on for the server.'));
		o.datatype = 'port';
		o.placeholder = '8928';

		o = s.taboption('advanced', form.Flag, 'mdns', _('Announce over mDNS'),
			_('Let a server discover the player. Ignored when a server address is set.'));
		o.default = o.enabled;
		/* the init script defaults a missing option to enabled */
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'server', _('Server address'),
			_('Connect to this server, as <code>host[:port]</code>, instead of waiting to be discovered.'));
		o.datatype = 'or(hostport,host)';

		o = s.taboption('advanced', form.Flag, 'allow_unpaired', _('Allow unpaired servers'),
			_('Connections are always encrypted. When enabled, any server on the network can play without pairing.'));

		o = s.taboption('advanced', form.ListValue, 'log_level', _('Log level'));
		o.value('none', _('None'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.value('verbose', _('Verbose'));
		o.default = 'info';

		o = s.taboption('advanced', form.Value, 'state_dir', _('State directory'),
			_('Stores the player\'s identity, pairings, volume, mute state and output delay. Use persistent storage: in RAM, this data is lost at each reboot and every server must pair again.'));
		o.placeholder = '/etc/sendspin-cli';

		/* Kept outside the map, which renders again after every save */
		const pairing = E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Pairing')), E('div') ]);
		const status = E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Status')), E('div') ]);

		const update = (current) => {
			pairing.lastElementChild.replaceChildren(renderPairingSection(current, refresh));
			status.lastElementChild.replaceChildren(renderStatus(current, refresh));
		};
		const refresh = () => sendspin.getPlayers().then((current) => {
			update(current);
			updatePairingDialog(current, refresh);
		});

		update(players);

		/*
		 * Often enough that a code shows up while the server waits for it, but
		 * leave the controls alone while one is being used
		 */
		poll.add(() => {
			const active = document.activeElement;

			if (active && (status.contains(active) || pairing.contains(active)) && active.matches('input, select'))
				return Promise.resolve();

			return refresh();
		}, 2);

		return m.render().then((node) => {
			node.querySelector('.cbi-map-descr')?.after(status, pairing);
			/* once the page is up, for an attempt already waiting on arrival */
			window.requestAnimationFrame(() => updatePairingDialog(players, refresh));
			return node;
		});
	}
});
