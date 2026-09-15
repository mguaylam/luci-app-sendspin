'use strict';
'require view';
'require form';
'require poll';
'require sendspin';

function renderStatus(players) {
	if (!players.length)
		return E('em', {}, _('No player is configured.'));

	return E('div', {}, players.map((player) => E('table', { 'class': 'table' },
		sendspin.describe(player).map(([ label, value ]) => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, label),
			E('td', { 'class': 'td left' }, value)
		]))
	)));
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
		const status = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Status')),
			E('div', {}, renderStatus(players))
		]);

		poll.add(() => sendspin.getPlayers().then((current) => {
			status.lastElementChild.replaceChildren(renderStatus(current));
		}), 5);

		return m.render().then((node) => {
			node.querySelector('.cbi-map-descr')?.after(status);
			return node;
		});
	}
});
