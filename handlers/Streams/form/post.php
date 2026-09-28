<?php

function Streams_form_post($params = array())
{
	if (empty($_REQUEST['inputs'])) {
		throw new Q_Exception_RequiredField(array('field' => 'inputs'));
	}
	$inputs = Q::json_decode($_REQUEST['inputs'], true);
	$user = Users::loggedInUser(true);
	$r = array_merge($_REQUEST, $params);
	$streams = array();
	foreach ($inputs as $name => $info) {
		$inputName = "input_$name";
		if (!isset($r[$inputName])) {
			continue;
		}
		if (!is_array($info) or count($info) < 4) {
			throw new Q_Exception_WrongValue(array(
				'field' => 'inputs',
				'range' => 'array of name => (streamExists, publisherId, streamName, fieldName)'
			));
		}
		list($streamExists, $publisherId, $streamName, $fieldName) = $info;
		$stream = Streams_Stream::fetch(null, $publisherId, $streamName);
		if (!$stream) {
			if ($user->id !== $publisherId
			or !Q_Config::get('Streams', 'possibleUserStreams', $streamName, false)) {
				throw new Users_Exception_NotAuthorized();
			}
			$stream = Streams::create(null, $publisherId, null, array(
				'name' => $streamName
			));
		}
		$attribute = (substr($fieldName, 0, 10) === 'attribute:')
			? substr($fieldName, 10)
			: null;

		// This handler used to save any field or attribute of any stream with
		// no access check. Apply what Streams/stream PUT applies to the same
		// edit (ro#862):
		// - only fields a client edit can set at all, never publisherId,
		//   name, type or the counters;
		// - the type's "edit" config: false refuses, a list limits the fields;
		// - the publisher, or the "edit" write level;
		// - the access fields need the publisher or the "own" admin level.
		// One deliberate difference from PUT: a type with no "edit" config
		// at all is not refused, because the in-tree caller (Communities'
		// profile form) writes the user's own Streams/user/height, a
		// Streams/number/length, which declares none. The access checks
		// still apply to it.
		$field = $attribute ? 'attributes' : $fieldName;
		$edit = Streams_Stream::getConfigField($stream->type, 'edit', null);
		$isPublisher = ($stream->publisherId === $user->id);
		if (!in_array($field, Streams::getExtendFieldNames($stream->type), true)
		or (isset($edit) and !$edit)
		or (is_array($edit) and !in_array($field, $edit, true))
		or (!$isPublisher and !$stream->testWriteLevel('edit'))
		or (in_array($field, array(
			'readLevel', 'writeLevel', 'adminLevel',
			'permissions', 'inheritAccess', 'closedTime'
		), true) and !$isPublisher and !$stream->testAdminLevel('own'))) {
			throw new Users_Exception_NotAuthorized();
		}

		if ($attribute) {
			$stream->setAttribute($attribute, $r[$inputName]);
		} else {
			$stream->$fieldName = $r[$inputName];
		}
		$stream->save();
		$streams[$stream->name] = $stream;
	}
	Q_Response::setSlot('streams', Db::exportArray($streams));
}