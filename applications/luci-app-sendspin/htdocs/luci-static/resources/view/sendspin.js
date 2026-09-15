'use strict';
'require view';
'require form';
'require poll';
'require ui';
'require sendspin';

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

		return E('table', { 'class': 'table' }, rows.map(([ label, value ]) => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, label),
			E('td', { 'class': 'td left' }, value)
		])));
	}));
}

return view.extend({
	load() {
		return Promise.all([
			sendspin.getPlayers(),
			sendspin.getPlaybackDevices()
		]);
	},

	render([ players, devices ]) {
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

		o = s.taboption('general', form.Value, 'audio_format', _('Preferred format'),
			_('Format offered to the server first, as <code>codec:rate:depth:channels</code>, e.g. <code>flac:48000:16:2</code>. Empty offers every format the device accepts.'));
		o.validate = (section_id, value) =>
			(!value || /^(flac|opus|pcm):\d+:\d+:\d+$/.test(value))
				? true
				: _('Expected codec:rate:depth:channels, with codec flac, opus or pcm');

		o = s.taboption('advanced', form.Value, 'buffer_ms', _('Buffer'),
			_('Audio kept buffered by the device, in milliseconds.'));
		o.datatype = 'range(10,2000)';
		o.placeholder = '100';

		o = s.taboption('advanced', form.Value, 'static_delay', _('Static delay'),
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

		o = s.taboption('advanced', form.ListValue, 'log_level', _('Log level'));
		o.value('none', _('None'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.value('verbose', _('Verbose'));
		o.default = 'info';

		o = s.taboption('advanced', form.Value, 'state_dir', _('State directory'),
			_('Where volume, mute, static delay and the last server are kept. The default is in RAM: lost at reboot, but the flash is spared.'));
		o.placeholder = '/var/lib/sendspin-cli';

		/* Kept outside the map, which renders again after every save */
		const status = E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Status')), E('div') ]);

		const refresh = () => sendspin.getPlayers().then((current) => {
			status.lastElementChild.replaceChildren(renderStatus(current, refresh));
		});

		status.lastElementChild.appendChild(renderStatus(players, refresh));

		/* Leave the controls alone while one is being used */
		poll.add(() => {
			const active = document.activeElement;

			if (active && status.contains(active) && active.matches('input, select'))
				return Promise.resolve();

			return refresh();
		}, 5);

		return m.render().then((node) => {
			node.querySelector('.cbi-map-descr')?.after(status);
			return node;
		});
	}
});
