<?php

/**
 * Get a summary of streams related to the specified user's
 * "Streams/user/interests" stream
 *
 * @param {array} $_REQUEST 
 *   @param {string} [$_REQUEST.userId=loggedInUserId] userId
 * @return {void}
 */
function Streams_interest_response_interests()
{
	$user = Users::loggedInUser();
	$userId = Q::ifset($_REQUEST, 'userId', null);
	// Asking for somebody else's interests is a client query. Two things gate it,
	// and both used to be missing (ro#552):
	//
	// 1. The config test was inverted. "allowClientQueries" defaulting to false
	//    means the query is NOT allowed, yet the old condition threw only when
	//    the config was TRUTHY -- so the shipped default permitted exactly what
	//    the exception message says it forbids. Test for the negation.
	// 2. The condition began with `$user and`, so a logged-OUT caller skipped
	//    the check entirely and could read any user's interests by userId. The
	//    least-privileged caller must not be the only one who is trusted, so
	//    membership of the check no longer depends on being logged in.
	//
	// Reading your own interests (no userId, or your own) is unaffected.
	if ($userId and (!$user or $userId != $user->id)) {
		if (!Q_Config::get('Streams', 'interests', 'allowClientQueries', false)) {
			throw new Q_Exception("Client queries are restricted, as per Streams/interests/allowClientQueries");
		}
		if (!$user) {
			// Even where client queries are allowed, they are allowed to
			// members, not to the anonymous public.
			throw new Users_Exception_NotLoggedIn();
		}
	}
	if ($userId) {
		$user = Users_User::fetch($userId);
	}
	if (!$user) {
		throw new Users_Exception_NotLoggedIn();
	}
	$return = Streams_Category::getRelatedTo(
		$user->id, 'Streams/user/interests', 'Streams/interests'
	);
	return $return ? $return : array();
}
