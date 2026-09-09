<?php

function Streams_avatar_response()
{
	$prefix = $userIds = $batch = $public = $communities = $platform = null;
	$limit = 10;
	extract($_REQUEST, EXTR_IF_EXISTS);
	$user = Users::loggedInUser();
	$asUserId = $user ? $user->id : "";

	if (isset($prefix)) {
		// Prefix search enumerates the user base -- ten avatars at a time, with
		// first name, last name and username on each -- so it is for members,
		// not for the anonymous public (ro#552). The old code did the opposite:
		// `$prefix or !$asUserId` routed a logged-OUT caller into
		// fetchByPrefix() even with an empty prefix, which is the whole
		// directory. Nothing in the platform or in our apps calls this
		// logged out: the callers are Streams/userChooser and the invite
		// dialogs, all of which require a session already.
		if (!$asUserId) {
			throw new Users_Exception_NotLoggedIn();
		}
		$options = @compact('limit', 'public', 'communities', 'platform');
		if ($prefix) {
			$avatars = Streams_Avatar::fetchByPrefix(
				$asUserId, 
				$prefix, 
				$options
			);
		} else {
			$userIds = Users_Contact::fetchUserIds($options);
			$avatars = Streams_Avatar::fetch($asUserId, $userIds);
			$count = count($userIds);
			if ($count < $limit) {
				$limit = $limit - $count;
				$moreAvatars = Streams_Avatar::fetchByPrefix(
					$asUserId, 
					$prefix, 
					$options
				);
				$avatars = array_merge($avatars, $moreAvatars);
			}
		}
	} else {
		if (isset($batch)) {
			$batch = json_decode($batch, true);
			if (!isset($batch)) {
				throw new Q_Exception_WrongValue(array('field' => 'batch', 'range' => '{userIds: [userId1, userId2, ...]}'));
			}
			if (!isset($batch['userIds'])) {
				throw new Q_Exception_RequiredField(array('field' => 'userIds'));
			}
			$userIds = $batch['userIds'];
		}
		if (!isset($userIds)) {
			throw new Q_Exception_RequiredField(array('field' => 'userIds'));
		}
		if (is_string($userIds)) {
			$userIds = explode(",", $userIds);
		}
		$avatars = Streams_Avatar::fetch($asUserId, $userIds);
	}

	$avatars = Db::exportArray($avatars);
	if (isset($batch)) {
		$result = array();
		foreach ($userIds as $userId) {
			$result[] = array('slots' =>
				array('avatar' => isset($avatars[$userId]) ? $avatars[$userId] : null)
			);
		}
		Q_Response::setSlot('batch', $result);
	} else {
		Q_Response::setSlot('avatars', $avatars);
	}
	return $avatars;
}