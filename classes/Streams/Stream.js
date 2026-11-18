/**
 * Class representing stream rows.
 *
 * @module Streams
 */
var Q = require('Q');
var Db = Q.require('Db');
var Streams = Q.require('Streams');
var Users = Q.require('Users');

Q.makeEventEmitter(Streams_Stream);

/**
 * Class representing 'Stream' rows in the 'Streams' database
 * <br/>stored primarily on publisherId's fm server
 * @namespace Streams
 * @class Stream
 * @extends Base.Streams.Stream
 * @constructor
 * @param fields {object} The fields values to initialize table row as
 * an associative array of `{column: value}` pairs
 */
function Streams_Stream (fields) {

	// Run constructors of mixed in objects
	Streams_Stream.constructors.apply(this, arguments);


	var p = {};
	
	/**
	 * Sets some extra data
	 * @method set
	 * @param {String} key
	 * @param {mixed} value
	 *  The value to set for that extra data
	 */
	this.set = function (key, value) {
		p[key] = value;
	};
	
	/**
	 * Gets the value of an extra field
	 * @method get
	 * @param {String} key
	 * @param {mixed} [def=null]
	 *  The value to return if the field is not found.
	 *  Defaults to undefined.
	 * @return {mixed}
	 *  The field if it is found, otherwise def or undefined.
	 */
	this.get = function (key, def) {
		if (key in p) return p[key];
		else return def;
	};
	
	/**
	 * Clears the value of an extra field
	 * @method clear
	 * @param {String} [key=null]
	 *  A key to clear. If null, clears all keys.
	 */
	this.clear = function (key) {
		if (key === undefined) p = {};
		else delete p[key];
	};
	
}

Sp = Streams_Stream.prototype;

/**
 * Calculate the canonical key of a stream
 * @static
 * @method key
 * @return {String} the key
 */
Sp.key = function () {
	return Streams.key(this.fields.publisherId, this.fields.name);
};

/**
 * Calculate the url of a stream's icon
 * @method iconUrl
 * @param {Number} [size=40] the size of the icon to render. Defaults to 40.
 * @return {String} the url
 */
Sp.iconUrl = function _Stream_prototype_iconUrl (size) {
	return Streams.iconUrl(this.fields.icon, size)
};

/**
 * @method getAllAttributes
 * @return {Object} The object of all attributes set in the stream
 */
Sp.getAllAttributes = function() {
	return this.fields.attributes ? JSON.parse(this.fields.attributes) : {};
};

/**
 * @method getAttribute
 * @param {String} attributeName The name of the attribute to get
 * @param {mixed} def The value to return if the attribute is missing
 * @return {mixed} The value of the attribute, or the default value, or null
 */
Sp.getAttribute = function(attributeName, def) {
	var attr = this.getAllAttributes();
	return (attributeName in attr) ? attr[attributeName] : def;
};

/**
 * @method setAttribute
 * @param {string} attributeName The name of the attribute to set,
 *  or an array of {attributeName: attributeValue} pairs
 * @param {mixed} value The value to set the attribute to
 * @return Streams_Stream
 */
Sp.setAttribute = function(attributeName, value) {
	var attr = this.getAllAttributes();
	if (Q.isPlainObject(attributeName)) {
		Q.extend(attr, attributeName);
	} else {
		attr[attributeName] = value;
	}
	this.fields.attributes = JSON.stringify(attr);

	return this;
};

/**
 * @method clearAttribute
 * @param {String} attributeName The name of the attribute to remove
 */
Sp.clearAttribute = function(attributeName) {
	var attr = this.getAllAttributes();
	delete attr[attributeName];
	this.fields.attributes = JSON.stringify(attr);
};

/**
 * @method clearAllAttributes
 */
Sp.clearAllAttributes = function() {
	this.fields.attributes = '{}';
};

/**
 * @method getAllPermissions
 * @return {Array}
 */
Sp.getAllPermissions = function () {
	try {
		return this.fields.permissions ? JSON.parse(this.fields.permissions) : [];
	} catch (e) {
		return [];
	}
};

/**
 * @method hasPermission
 * @param {String} permission
 * @param {Boolean}
 */
Sp.hasPermission = function (permission) {
	return (this.getAllPermissions().indexOf(permission) >= 0);
};

/**
 * @method addPermission
 * @param {String} permission
 */
Sp.addPermission = function (permission) {
	var permissions = this.getAllPermissions();
	if (permissions.indexOf(permission) < 0) {
		permissions.push(permission);
	}
	this.permissions = JSON.stringify(permissions);
};

/**
 * @method removePermission
 * @param {String} permission
 * @param {Boolean}
 */
Sp.removePermission = function (permission) {
	var permissions = this.getAllPermissions();
	var index = permissions.indexOf(permission);
	if (index >= 0) {
		permissions.splice(index, 1);
	}
	this.permissions = JSON.stringify(permissions);
};

Q.mixin(Streams_Stream, Q.require('Base/Streams/Stream'));

Streams_Stream.construct = function Streams_Stream_construct(fields, retrieved) {
	if (Q.isEmpty(fields)) {
		return false;
	}
	if (fields.fields) {
		fields = fields.fields;
	}
	var type = Q.normalize(fields.type);
	var SC = Streams.defined[type];
	if (!SC) {
		SC = Streams.defined[type] = function StreamConstructor(fields) {
			StreamConstructor.constructors.apply(this, arguments);
			// Default constructor. Copy any additional fields.
			if (!fields) return;
			for (var k in fields) {
				this.fields[k] = Q.copy(fields[k]);
				if (this.fields[k] instanceof Buffer) {
					this.fields[k] = this.fields[k].toString();
				}
			}
		};
		Q.mixin(SC, Streams_Stream);
	}
	var stream = new SC(fields);
	if (retrieved) {
		stream.retrieved = true;
		stream._fieldsModified = {};
	}
	return stream;
};

Streams_Stream.define = Streams.define;

/**
 * Gets a value from the config corresponding to this stream type and a field name,
 * using defaults from "Streams"/"types"/"*" and merging the value under
 * "Streams"/"types"/$stream->type, if any.
 * @method getConfigField
 * @static
 * @param {String} type The type of the stream
 * @param {String|Array} field The name of the field, or array of path keys
 * @param {mixed} def The value to return if the config field isn't specified
 * @param {Boolean} [merge=true] if objects are found in both places, merge them
 * @return mixed
 */
Streams_Stream.getConfigField = function (type, field, def, merge)
{
	if (typeof field === 'string') {
		field = [field];
	}
	var path1 = ['Streams', 'types', '*'].concat(field);
	var path2 = ['Streams', 'types', type].concat(field);
	var bottom = Q.Config.get(path1, def);
	var top = Q.Config.get(path2, null);
	if (merge && Q.isPlainObject(bottom) && Q.isPlainObject(top)) {
		return Q.extend({}, bottom, top);
	}
	return top ? top : bottom;
}

/**
 * The setUp() method is called the first time
 * an object of this class is constructed.
 * @method setUp
 */
Sp.setUp = function () {
	// put any code here
};

/**
 * Verifies whether Stream can be handled. Can be called syncronously and in such case skips
 * verification of inherited access or asyncronously to make ful check
 * @method testLevel
 * @private
 * @param {string} subj
 * @param {string} type
 * @param {string} values
 * @param {string|integer} level
 * @param {function} [callback=null]
 *  Use this when streams can inherit access.
 *	Callback receives "error" and boolean as arguments - whether the access is granted.
 */
function testLevel (subj, type, values, level, callback) {
	if (subj.publishedByFetcher) {
		callback && callback.call(subj, null, true);
		return true;
	}
	if (subj.fields.closedTime && level !== 'close' && !subj.testWriteLevel('close')) {
		// Answer an asynchronous caller too: returning without calling back
		// left callers waiting forever (ro#1172 fix-review, R06).
		callback && callback.call(subj, null, false);
		return false;
	}
	var LEVEL = Streams[values];
	if (typeof level === "string") {
		if (typeof LEVEL[level] === "undefined") return false;
		level = LEVEL[level];
	}
	if (level < 0) {
		callback && callback.call(subj, null, false);
		return false;
	}

	var fp = Streams_Stream.getConfigField(subj.fields.type, ['fromPermissions']) || [];
	var permissions = subj.getAllPermissions();
	var m = subj.get(type, 0);
	for (var i=0; i<permissions.length; ++i) {
		var p = permissions[i];
		if (fp[p] && fp[p][type] > 0) {
			var l = fp[p][type];
			l = (typeof l === 'string' ? LEVEL[l] : l);
			m = Math.max(l, m);
		}
	}

	if (m >= level) {
		callback && callback.call(subj, null, true);
		return true;
	}

	var levelSource = subj.get(type+'_source', 0);
	if (levelSource === Streams.ACCESS_SOURCES['direct'] ||
		levelSource == Streams.ACCESS_SOURCES['inherited_direct']) {
		callback && callback.call(subj, null, false);
		return false;
	}
	callback && subj.inheritAccess(function(err, res) {
		if (err) {
			callback.call(subj, err);
		} else {
			if (!res) callback.call(subj, null, false);
			else {
				if (subj.get(type, 0) >= level) callback.call(subj, null, true);
				else callback.call(subj, null, false);
			}
		}
	});
	return false;
}

function _sortTemplateTypes(templates, field, returnAll, nameField) {
	var ret = [[], [], [], []];
	if (!templates.length) {
		ret.templateType = -1;
		return returnAll ? ret : null;
	}
	// The order of the templates will be from most specific to most generic:
	// 	0. exact stream name and exact publisher id - this would be the row itself
	//	1. generic stream name and exact publisher id
	//	2. exact stream name and generic publisher
	//	3. generic stream name and generic publisher
	// Note: Only -1, 1 and 3 are possible values stored in $type
	// since templates are always selected ending in "/"
	var i, l, t, pos, name, key;
	nameField = nameField || 'streamName';
	for (i=0, l=templates.length; i<l; i++) {
		t = templates[i];
		name = t.fields[nameField];
		pos = name.length - 1;
		if (t.fields[field] === '') {
			key = (name[pos] === '/') ? 3 : 2; // generic publisher
		} else {
			key = (name[pos] === '/') ? 1 : 0; // userId
		}
		ret[key].push(t);
	}
	if (returnAll) {
		// we are looking for all templates
		return ret;
	}
	// we are looking for exactly one template
	for (i=0; i<4; type++) {
		if (ret[i][0]) {
			ret.templateType = i;
			return ret[i][0];
		}
	}
	return null;
}

/**
 * @method getSubscriptionTemplate
 * @param {String} className The class extending Db_Row to fetch from the database
 * @param {String} ofUserId The id of the possible subscriber
 * @param {&integer} [templateType=null] Gets filled with the template type 0-4. 
 *   Set to true to return all templates.
 * @return {Streams.Subscription|Array} Returns the template subscription, 
 *   or an array if $templateType is true
 */
Sp.getSubscriptionTemplate = function(className, ofUserId, callback, returnAll) {
	// fetch template for subscription's PK - publisher, name & user
	var stream = this;
	Streams[className].SELECT('*').where({
		publisherId: stream.fields.publisherId,
		streamName: stream.fields.type+'/',
		ofUserId: ['', ofUserId]
	}).execute(function(err, res) {
		if (err) {
			return callback.call(stream, err);
		}
		callback.call(stream, null, _sortTemplateTypes(res, 'ofUserId', returnAll));
	});
};

/**
 * Update the participant counts
 * @method updateParticipantCounts
 * @param {String} newState
 * @param {String} prevState
 * @param {Function} [callback=null]
 *	Callback receives "error" and "result" as arguments
 */
Sp.updateParticipantCounts = function (newState, prevState, callback) {
	if (prevState) {
		this.fields[prevState+'Count'] = new Db.Expression(prevState+'Count - 1');
	}
	this.fields[newState+'Count'] = new Db.Expression(newState+'Count + 1');
	this.save(function () {
		this.retrieve('*', true, callback);
	});
};

/**
 * Send some payload which is not saved as a message in the stream's history,
 * * shouldn't change the state on the server at all, nor generate offline notifications,
 * but is broadcast to everyone curently connected by a socket and participating
 * or observing the stream.
 * This can be used for read receipts, "typing..." indicators, cursor movements and more.
 *
 * @method ephemeral
 * @param {Object} payload the payload to send. It must have "type" set at least.
 * @param {Boolean} [dontNotifyObservers] whether to skip notifying observers who aren't registered users
 * @param {Function} [callback] receives (err, result) as parameters
 */
Sp.ephemeral = function _Stream_ephemeral (
	payload, dontNotifyObservers, callback
) {
	payload.publisherId = publisherId;
	payload.streamName = streamName;
	this.notifyParticipants(
		'Streams/ephemeral', byUserId, payload, dontNotifyObservers, callback
	);
};

/**
 * Sends a message to all participants of a stream.
 * Also sends it to observers unless dontNotifyObservers is true.
 * @method notifyParticipants
 * @param {String} event The type of Streams event, such as "Streams/post" or "Streams/remove"
 * @param {Streams.Message|Streams.Ephemeral} messageOrEphemeral can be a Streams.Message or an Streams.Ephemeral
 * @param {Boolean} [dontNotifyObservers] whether to skip notifying observers who aren't registered users
 * @param {Function} [callback] Optional, receives receives (err, participants)
 * @return {Boolean} Whether the system went on to get and notify participants
 */
Sp.notifyParticipants = function (event, messageOrEphemeral, dontNotifyObservers, callback) {
	var stream = this;

	// messageOrEphemeral.stream = stream;

	var streamId = Streams_Stream.logId(this);

	// The fan-out walks the participants in batches, and computes access for a
	// whole batch with a fixed number of queries (ro#1172). It used to fetch at
	// most getParticipantsLimit (100) participants, newest first, and then run
	// calculateAccess() once per participant: two streams_access queries each,
	// all queued at once on the shard's single connection, each holding its
	// cloned query objects until its turn. A post to a 100-member conversation
	// held ~120 MB of node heap for ~10 s, so two posts in a row OOM-killed a
	// 256M node. Every participant after the newest 100 never received the
	// message at all. Now each batch costs one participants query plus two
	// access queries (three with contact labels) whatever its size; the next
	// batch is fetched only after this one's access is computed, so a post
	// holds at most one batch of rows at a time however large the stream is.
	// Two kinds of work still cost queries per participant, and each runs
	// through its own process-wide limit: offline notifications to subscribed
	// participants (_offlineSlot), and access that depends on inheritAccess,
	// which fetches each inherited stream as the participant (_decideRead).
	// Observers get the same per-user treatment in notifyObservers.
	var batchSize = parseInt(Q.Config.get(['Streams', 'notifications', 'batchSize'], 100));
	if (!(batchSize > 0)) {
		batchSize = 100;
	}
	var notifiedObservers = false;
	_batch(null);

	function _batch(afterUserId) {
		Streams_Stream.participantsAfter(stream, afterUserId, batchSize,
		function (err, rows) {
			// DO NOT remove this check. The DB layer hands back `undefined` on any
			// DB failure (dropped connection, MySQL restart, query timeout). This callback
			// runs off the mysql driver's event loop turn, so a TypeError thrown here has
			// nothing above it to catch: node reports UNCAUGHT EXCEPTION and *exits*, the
			// supervisor restarts it, and every connected socket is dropped — a crash loop
			// several times a minute under normal chat load. It used to read
			// `Object.keys(participants) || []`, where the `|| []` looks like a guard but
			// is evaluated after the throw. See docs/qbix-gotchas.md
			// § "A DB error in a node callback exits the process".
			if (err || !rows) {
				Q.log("Streams.Stream.notifyParticipants: cannot get participants for stream "
					+ streamId + ", event '" + event + "' NOT delivered"
					+ (afterUserId ? " to participants after '" + afterUserId + "'" : "")
					+ ": " + Streams_Stream.describeError(err
						|| new Error("getParticipants returned no participants")));
				return callback && callback(err
					|| new Error("Streams.Stream.notifyParticipants: no participants returned"));
			}
			var participants = {};
			for (var i = 0; i < rows.length; ++i) {
				participants[rows[i].fields.userId] = rows[i];
			}
			var userIds = Object.keys(participants);
			// Observers are told once, as soon as the first batch was read.
			// notifyObservers decides each observer's access on its own view.
			if (!dontNotifyObservers && !notifiedObservers) {
				notifiedObservers = true;
				stream.notifyObservers(event, messageOrEphemeral);
			}
			Streams_Stream.calculateAccessForUsers(stream, userIds, participants,
			function (err, views) {
				if (err) {
					// Fail closed: without a computed access level nobody in this
					// batch may receive the event.
					// Only this batch is skipped: the paging cursor does not depend
					// on the access result, so later batches are still delivered
					// (ro#1172 audit, R05: one transient error used to drop
					// everyone after it in userId order).
					Q.log("Streams.Stream.notifyParticipants: cannot calculate access for stream "
						+ streamId + ", event '" + event + "' NOT delivered to the "
						+ userIds.length + " participant(s) of this batch"
						+ (afterUserId ? " (after '" + afterUserId + "')" : "")
						+ "; continuing with the next batch: "
						+ Streams_Stream.describeError(err));
					callback && callback(err, participants);
				} else {
					userIds.forEach(function (userId) {
						_notifyOne(participants, userId, views[userId]);
					});
				}
				if (rows.length >= batchSize) {
					_batch(rows[rows.length - 1].fields.userId);
				}
			});
		});
	}

	function _notifyOne(participants, userId, view) {
		// The completion closure can sit in the offline queue for a while, so
		// it is made by _completion(), whose scope holds only the userId and,
		// when a caller asked for them, the batch's rows. Creating it in this
		// scope would keep this participant's row and access view alive with
		// it (measured: +100 MiB at the #1143 ramp).
		var done = _completion(userId, callback ? participants : null);
		var participant = participants[userId];
		var level;
		try {
			level = _readLevelFor(messageOrEphemeral);
		} catch (e) {
			// e.g. Streams/Stream/remove passes a null message: let notify()
			// throw and be logged, as before.
			return _send(participant, userId, view, null, done);
		}
		// Most participants are decided synchronously from the batch's rows.
		// Those whose access depends on inheritAccess go through a bounded
		// slot, since each costs a fetchOne per inherited stream (R03).
		_decideRead(view, level, function (err, allowed) {
			_send(participant, userId, view, { err: err, allowed: allowed }, done);
		});
	}

	function _completion(userId, batch) {
		return function (err) {
			callback && callback(err, batch);
			if (!err) return;
			// Always log. This used to be gated behind the
			// Streams/notifications/debug config, which defaults to false, so
			// socket delivery failed completely silently in production and read
			// as "flaky realtime" rather than as a dead DB connection.
			Q.log("Streams.Stream.notifyParticipants: failed to notify user '"
				+ userId + "' of event '" + event + "' on stream " + streamId
				+ ": " + Streams_Stream.describeError(err));
			if (Q.Config.get(["Streams", "notifications", "debug"], false)) {
				Q.log(err);
			}
		};
	}

	function _send(participant, userId, view, decision, done) {
		try {
			stream.notify(participant, event, messageOrEphemeral, done, view, decision);
		} catch (e) {
			// notify() can also throw synchronously — e.g. it calls
			// messageOrEphemeral.getType(), and Streams/Stream/remove passes null.
			// One bad participant must not take the whole process down.
			Q.log("Streams.Stream.notifyParticipants: notify() threw for user '"
				+ userId + "', event '" + event + "' on stream " + streamId
				+ ": " + Streams_Stream.describeError(e));
		}
	}
	return true;
};

/**
 * Sends a message to all observers of a stream,
 * i.e. socket clients besides the ones which are associated to participants.
 * This can include socket clients that are not associated to any user.
 * @method notifyObservers
 * @param {String} event The type of Streams event, such as "Streams/post" or "Streams/remove"
 * @param {Streams_Message|Steams_Ephemeral} messageOrEphemeral pass a message with instructions or ephemeral with payload
 */
Sp.notifyObservers = function (event, messageOrEphemeral) {
	var stream = this;
	var streamId = Streams_Stream.logId(this);
	// Each observer's access is decided per post on its own view of the stream,
	// batched like the participants' (ro#1172 audit, R01). This used to call
	// getObservers(), whose testReadLevel('messages') read the *shared* stream:
	// it passed only by accident, because the old per-participant
	// calculateAccess() calls had just written their levels onto that object.
	// Observers without a user (logged-out sockets) get what
	// calculateAccess('') gives: the stream's own public levels, the same rule
	// the Streams/observe handler applied when they started observing.
	var observers = Q.getObject(
		[stream.fields.publisherId, stream.fields.name],
		Streams.observers
	) || {};
	var byUser = {};
	Object.keys(observers).forEach(function (clientId) {
		var client = observers[clientId];
		var userId = (client && client.capability && client.capability.userId) || '';
		(byUser[userId] = byUser[userId] || []).push(clientId);
	});
	var userIds = Object.keys(byUser);
	if (!userIds.length) {
		return;
	}
	var level;
	try {
		level = _readLevelFor(messageOrEphemeral);
	} catch (e) {
		level = Streams.READ_LEVEL['messages'];
	}
	Streams_Stream.calculateAccessForUsers(stream, userIds.filter(function (u) {
		return u !== '';
	}), null, function (err, views) {
		if (err) {
			Q.log("Streams.Stream.notifyObservers: cannot calculate access for stream "
				+ streamId + ", event '" + event + "' NOT delivered to "
				+ Object.keys(observers).length + " observer(s): "
				+ Streams_Stream.describeError(err));
			return;
		}
		if (byUser['']) {
			views[''] = Streams_Stream.accessView(stream);
			_resetAccess(views[''], '');
		}
		userIds.forEach(function (userId) {
			_decideRead(views[userId], level, function (err, allowed) {
				if (err) {
					Q.log("Streams.Stream.notifyObservers: cannot decide access of user '"
						+ userId + "' to stream " + streamId + ", event '" + event
						+ "' NOT delivered to their observers: "
						+ Streams_Stream.describeError(err));
					return;
				}
				if (!allowed) {
					return;
				}
				byUser[userId].forEach(function (clientId) {
					try {
						observers[clientId].emit(event, messageOrEphemeral.getFields(), {
							publisherId: stream.fields.publisherId,
							streamName: stream.fields.name,
							streamType: stream.fields.type,
							messageCount: stream.fields.messageCount
						});
					} catch (e) {
						// One dead socket must not abort the fan-out to the others,
						// nor take the process down from inside an async callback.
						Q.log("Streams.Stream.notifyObservers: emit failed for client '"
							+ clientId + "', event '" + event + "' on stream " + streamId
							+ ": " + Streams_Stream.describeError(e));
					}
				});
			});
		});
	});
};

/**
 * Set access data for the stream. Acces data is calculated:
 *	<ol>
 *		<li>from read/write/admin level fields of the stream</li>
 *		<li>from labels. Streams_Access record may contain &lt;publisherId&gt;, &lt;streamName&gt;
 *			(allowed exact match or generic name "&lt;streamType&gt;/") and
 *			&lt;ofContactLabel&gt;. If &lt;publisherId&gt; is recorded in Users_Contact
 *			to have either current user or &lt;ofContactLabel&gt; as contact, access claculation is
 *			considering such record.</li>
 *		<li>from user. Stream_Access record may contain &lt;publisherId&gt;, &lt;streamName&gt;
 *			(allowed exact match or generic name "&lt;streamType&gt;/") and
 *			&lt;ofUserId&gt;. Such record is considered in access calculation.</li>
 *	</ol>
 * @method calculateAccess
 * @param {string|function} asUserId
 * @param {function} [callback]
 *	Callback receives "error" as argument
 */
Sp.calculateAccess = function(asUserId, callback) {
	if (typeof asUserId === "function") {
		callback = asUserId;
		asUserId = null;
	}
	if (!callback) {
		return;
	}
	var subj = this;

	if (_resetAccess(subj, asUserId)) {
		return callback.call(subj);
	}

	// For workspace publishers (e.g. "alice~ws1"), resolve access against
	// the base publisher ("alice") so label/contact lookups work correctly.
	var publisherIdForAccess = _publisherIdForAccess(subj);

	var p = new Q.Pipe(['rows1', 'rows2'], function (res) {
		var err = res.rows1[0] || res.rows2[0];
		if (err) {
			return callback.call(subj, err);
		}
		_applyAccessRows(subj, asUserId, res.rows1[1], res.rows2[1], _lookup, callback);
	});

	// Get the per-label access data
	// Avoid making a join to allow more flexibility for sharding
	Streams.Access.SELECT('*').where({
		'publisherId': publisherIdForAccess,
		'streamName': this.fields.name, // exact stream
		'ofUserId': this.fields.name.substr(-1) === '/' ? asUserId : ['', asUserId]
			// and either generic or specific user, if check template access use only specific
	}).execute(p.fill('rows1'));

	Streams.Access.SELECT('*').where({
		'publisherId': ['', publisherIdForAccess],
		'streamName': this.fields.type+"*",	// generic stream
		'ofUserId': ['', asUserId]				// and specific user
	}).execute(p.fill('rows2'));

	function _lookup(labels, fetchParticipantRow, done) {
		var p = new Q.Pipe(['contacts', 'participants'], function (res) {
			// This used to call back with an unrelated (always empty) variable,
			// so a failed contacts or participant query read as success and the
			// level computed so far was used. Report the real error (ro#1172).
			var err = res.contacts[0] || res.participants[0];
			if (err) {
				return done(err);
			}
			done(null, res.contacts[1], res.participants[1]);
		});
		if (labels.length > 0) {
			Users.Contact.SELECT('*').where({
				'userId':  subj.fields.publisherId,
				'label': labels,
				'contactUserId': asUserId
			}).execute(p.fill('contacts'));
		} else {
			p.fill('contacts')(null, []);
		}
		if (fetchParticipantRow) {
			Streams.Participant.SELECT('*').where({
				'publisherId': subj.fields.publisherId,
				'streamName': subj.fields.name,
				'userId': asUserId
			}).execute(p.fill('participants'));
		} else {
			p.fill('participants')(null, []);
		}
	}
};

/**
 * Calculates access to a stream for many users at once, with a fixed number of
 * queries however many users there are: two streams_access queries for all of
 * them, plus one contacts query and at most one participants query when the
 * access rows name contact labels or participant roles. The result for each
 * user is exactly what stream.calculateAccess(userId) computes, but it is held
 * on a separate per-user view of the stream, so the shared stream object is
 * never modified and concurrent calculations cannot see each other's levels
 * (ro#1172).
 * @method calculateAccessForUsers
 * @static
 * @param {Streams_Stream} stream
 * @param {Array} userIds
 * @param {Object} [participants] Streams_Participant rows of this stream, by
 *   userId, that are already in hand (notifyParticipants passes its batch).
 *   Rows missing from it are queried when an access row needs them.
 * @param {Function} callback Receives (err, views), where views[userId] is an
 *   object that inherits from the stream, with its own get/set/clear and its
 *   own publishedByFetcher, on which testReadLevel() etc. answer for that user.
 */
Streams_Stream.calculateAccessForUsers = function (stream, userIds, participants, callback) {
	participants = participants || {};
	var views = {};
	var pending = [];
	userIds.forEach(function (userId) {
		var view = views[userId] = Streams_Stream.accessView(stream);
		if (!_resetAccess(view, userId)) {
			pending.push(userId);
		}
	});
	if (!pending.length) {
		return callback(null, views);
	}
	var publisherIdForAccess = _publisherIdForAccess(stream);
	var isTemplate = stream.fields.name.substr(-1) === '/';
	var p = new Q.Pipe(['rows1', 'rows2'], function (res) {
		var err = res.rows1[0] || res.rows2[0];
		if (err) {
			return callback(err);
		}
		var rows1 = res.rows1[1];
		var rows2 = res.rows2[1];
		var requests = [];
		var remaining = pending.length;
		var failed = null;
		pending.forEach(function (userId) {
			// Each user sees exactly the rows its own calculateAccess queries
			// would have returned, in the order the database returned them.
			var r1 = rows1.filter(function (row) {
				var of = row.fields.ofUserId;
				return of === userId || (!isTemplate && of === '');
			});
			var r2 = rows2.filter(function (row) {
				var of = row.fields.ofUserId;
				return of === userId || of === '';
			});
			_applyAccessRows(views[userId], userId, r1, r2,
			function (labels, fetchParticipantRow, done) {
				requests.push({
					userId: userId,
					labels: labels,
					fetchParticipantRow: fetchParticipantRow,
					done: done
				});
			}, _finished);
		});
		if (requests.length) {
			_lookupAll(requests);
		}
		function _finished(err) {
			if (failed) {
				return;
			}
			if (err) {
				failed = err;
				return callback(err);
			}
			if (--remaining === 0) {
				callback(null, views);
			}
		}
	});

	Streams.Access.SELECT('*').where({
		'publisherId': publisherIdForAccess,
		'streamName': stream.fields.name, // exact stream
		'ofUserId': isTemplate ? pending : [''].concat(pending)
	}).execute(p.fill('rows1'));

	Streams.Access.SELECT('*').where({
		'publisherId': ['', publisherIdForAccess],
		'streamName': stream.fields.type+"*",	// generic stream
		'ofUserId': [''].concat(pending)
	}).execute(p.fill('rows2'));

	function _lookupAll(requests) {
		var labels = [], contactUserIds = [], missing = [];
		requests.forEach(function (r) {
			if (r.labels.length) {
				contactUserIds.push(r.userId);
				r.labels.forEach(function (label) {
					if (labels.indexOf(label) < 0) {
						labels.push(label);
					}
				});
			}
			if (r.fetchParticipantRow && !participants[r.userId]) {
				missing.push(r.userId);
			}
		});
		var p = new Q.Pipe(['contacts', 'participants'], function (res) {
			var err = res.contacts[0] || res.participants[0];
			var contacts = res.contacts[1] || [];
			var fetched = {};
			(res.participants[1] || []).forEach(function (row) {
				fetched[row.fields.userId] = row;
			});
			requests.forEach(function (r) {
				if (err) {
					return r.done(err);
				}
				var c = r.labels.length ? contacts.filter(function (contact) {
					return contact.fields.contactUserId === r.userId
						&& r.labels.indexOf(contact.fields.label) >= 0;
				}) : [];
				var row = r.fetchParticipantRow
					&& (participants[r.userId] || fetched[r.userId]);
				r.done(null, c, row ? [row] : []);
			});
		});
		if (labels.length) {
			Users.Contact.SELECT('*').where({
				'userId':  stream.fields.publisherId,
				'label': labels,
				'contactUserId': contactUserIds
			}).execute(p.fill('contacts'));
		} else {
			p.fill('contacts')(null, []);
		}
		if (missing.length) {
			Streams.Participant.SELECT('*').where({
				'publisherId': stream.fields.publisherId,
				'streamName': stream.fields.name,
				'userId': missing
			}).execute(p.fill('participants'));
		} else {
			p.fill('participants')(null, []);
		}
	}
};

/**
 * A per-user view of a stream for access calculations: it inherits fields and
 * methods from the stream, but has its own extra-data store (get/set/clear)
 * and its own publishedByFetcher, so calculateAccess() and testReadLevel()
 * called on it never touch the shared stream object (ro#1172).
 * @method accessView
 * @static
 * @param {Streams_Stream} stream
 * @return {Object}
 */
Streams_Stream.accessView = function (stream) {
	var view = Object.create(stream);
	var p = {};
	view.set = function (key, value) {
		p[key] = value;
	};
	view.get = function (key, def) {
		if (key in p) return p[key];
		else return def;
	};
	view.clear = function (key) {
		if (key === undefined) p = {};
		else delete p[key];
	};
	view.publishedByFetcher = false;
	return view;
};

/**
 * Batch of a stream's participants with userId after afterUserId, in userId
 * order. Paging by key rather than by offset cannot skip or repeat anyone when
 * rows are added or removed between batches.
 * @method participantsAfter
 * @static
 * @param {Streams_Stream} stream
 * @param {String|null} afterUserId null for the first batch
 * @param {Number} limit
 * @param {Function} callback Receives (err, rows)
 */
Streams_Stream.participantsAfter = function (stream, afterUserId, limit, callback) {
	var criteria = {
		publisherId: stream.fields.publisherId,
		streamName: stream.fields.name
	};
	if (afterUserId != null) {
		criteria.userId = new Db.Range(afterUserId, false, false, null);
	}
	Streams.Participant.SELECT('*').where(criteria)
		.orderBy('userId', true)
		.limit(limit)
		.execute(callback);
};

// Resets the access levels held on subj to the stream's own fields, for
// asUserId. Returns true when nothing more is needed: no user, or the user is
// the publisher (who gets max access without any queries).
function _resetAccess(subj, asUserId) {
	var public_source = Streams.ACCESS_SOURCES['public'];
	var direct_source = Streams.ACCESS_SOURCES['direct'];

	subj.set('asUserId', asUserId);
	subj.set('readLevel', subj.fields.readLevel);
	subj.set('writeLevel', subj.fields.writeLevel);
	subj.set('adminLevel', subj.fields.adminLevel);
	subj.set('permissions', subj.getAllPermissions());
	subj.set('readLevel_source', public_source);
	subj.set('writeLevel_source', public_source);
	subj.set('adminLevel_source', public_source);
	subj.set('permissions_source', public_source);

	if (!asUserId) {
		return true;
	}

	// For workspace publishers (e.g. "alice~ws1"), resolve access against
	// the base publisher ("alice") so the owner still gets full access to
	// their own workspace streams, and label/contact lookups work correctly.
	var publisherIdForAccess = _publisherIdForAccess(subj);

	if (asUserId && asUserId === publisherIdForAccess) {
		var required = Q.Config.get(['Streams', 'requiredUserStreams', subj.fields.name], false);
		subj.set('isRequired', required);
		subj.set('readLevel', Streams.READ_LEVEL['max']);
		subj.set('writeLevel', Streams.WRITE_LEVEL['max']);
		subj.set('adminLevel', Streams.ADMIN_LEVEL['max']);
		subj.set('readLevel_source', direct_source);
		subj.set('writeLevel_source', direct_source);
		subj.set('adminLevel_source', direct_source);
		subj.publishedByFetcher = true;
		return true;
	}
	return false;
}

function _publisherIdForAccess(subj) {
	var publisherIdForAccess = subj.fields.publisherId;
	var tildePos = publisherIdForAccess.indexOf('~');
	if (tildePos !== -1) {
		publisherIdForAccess = publisherIdForAccess.slice(0, tildePos);
	}
	return publisherIdForAccess;
}

// Applies the streams_access rows for asUserId to subj: rows1 are the rows for
// the exact stream name, rows2 those for the "<type>*" template. lookup(labels,
// fetchParticipantRow, done) supplies the contacts and participant rows that
// labelled or role-based rows need, as done(err, contacts, participants).
// Calls callback.call(subj, err) exactly once.
function _applyAccessRows(subj, asUserId, rows1, rows2, lookup, callback) {
	var i, j, row;
	for (i = 0; i < rows2.length; ++i) {
		var access = rows2[i].fields;
		if (
			access.ofUserId === '' &&
			!access.ofContactLabel &&
			!access.ofParticipantRole
		) {
			var head = access.streamName.slice(0, -1);
			if (subj.fields.type === head) {
				_setStreamAccess(subj, rows2[i], Streams.ACCESS_SOURCES['public']);
			}
		}
	}
	// Apply universal access overrides for concrete (non-mutable) rules
	for (i = 0; i < rows1.length; ++i) {
		var access = rows1[i].fields;
		if (
			access.publisherId === '' &&
			access.ofUserId === '' &&
			!access.ofContactLabel &&
			!access.ofParticipantRole
		) {
			// Concrete universal rule: matches this exact stream name
			if (access.streamName === subj.fields.name) {
				_setStreamAccess(subj, rows1[i], Streams.ACCESS_SOURCES['public']);
			}
		}
	}
	var rows = rows1.concat([]);
	theloop:
	for (i=0; i<rows2.length; ++i) {
		var row2 = rows2[i];
		for (j=0; j<rows1.length; ++j) {
			var row1 = rows1[j];
			if (row2.fields.streamName
			=== row1.fields.streamName + '*') {
				// skip the mutable access, because
				// explicit stream access overrides it
				continue theloop;
			}
		}
		rows.push(row2);
	}
	var labels = [];
	var fetchParticipantRow = false;
	for (i=0; i<rows.length; i++) {
		row = rows[i];
		if (row.fields.ofContactLabel) {
			labels.push(row.fields.ofContactLabel);
		}
		if (row.fields.ofParticipantRole) {
			fetchParticipantRow = true;
		}
	}
	if (!labels.length && !fetchParticipantRow) {
		return _perUserData(subj, asUserId, rows, callback);
	}
	lookup(labels, fetchParticipantRow, function (err, contacts, participants) {
		if (err) {
			return callback.call(subj, err);
		}

		// NOTE: we load arrays into memory and hope they are not too large
		var i, j;
		for (i=0; i<rows.length; ++i) {
			var row = rows[i];
			for (j=0; j<contacts.length; j++) {
				if (row.fields.ofContactLabel === contacts[j].fields.label) {
					_setStreamAccess(subj, rows[i], Streams.ACCESS_SOURCES['contact']);
				}
			}
			var p = participants[0];
			// As PHP Streams::calculateAccess: a role only counts while the
			// participant is participating (ro#1172 audit, R02).
			if (p && p.fields.state === 'participating'
			&& p.testRoles(row.fields.ofParticipantRole)) {
				_setStreamAccess(subj, rows[i], Streams.ACCESS_SOURCES['participant']);
			}
		}
		_perUserData(subj, asUserId, rows, callback);
	});
}

function _setStreamAccess(stream, access, source) {
	var readLevel =  stream.get('readLevel', 0);
	var writeLevel = stream.get('writeLevel', 0);
	var adminLevel = stream.get('adminLevel', 0);
	if (access.fields.readLevel >= 0 && access.fields.readLevel > readLevel) {
		stream.set('readLevel', access.fields.readLevel);
		stream.set('readLevel_source', source);
	}
	if (access.fields.writeLevel >= 0 && access.fields.writeLevel > writeLevel) {
		stream.set('writeLevel', access.fields.writeLevel);
		stream.set('writeLevel_source', source);
	}
	if (access.fields.adminLevel >= 0 && access.fields.adminLevel > adminLevel) {
		stream.set('adminLevel', access.fields.adminLevel);
		stream.set('adminLevel_source', source);
	}
	var p1 = stream.get('permissions', []);
	var p2 = access.getAllPermissions();
	var p3 = [].concat(p1);
	for (var k=0; k<p2.length; ++k) {
		if (p3.indexOf(p2[k]) < 0) {
			p3.push(p2[k]);
		}
	}
	stream.set('permissions', p3);
	stream.set('permissions_source', source);
	 // NOTE: permissions are merged from more than one source
}

function _perUserData(subj, asUserId, rows, callback) {
	var row, i;
	var direct_source = Streams.ACCESS_SOURCES['direct'];
	for (i=0; i<rows.length; i++) {
		row = rows[i];
		if (row.fields.ofUserId === asUserId) {
			if (row.fields.readLevel >= 0) {
				subj.set('readLevel', row.fields.readLevel);
				subj.set('readLevel_source', direct_source);
			}
			if (row.fields.writeLevel >= 0) {
				subj.set('writeLevel', row.fields.writeLevel);
				subj.set('writeLevel_source', direct_source);
			}
			if (row.fields.adminLevel >= 0) {
				subj.set('adminLevel', row.fields.adminLevel);
				subj.set('adminLevel_source', direct_source);
			}
			if (row.fields.permissions != null) {
				subj.set('permissions', row.getAllPermissions());
				subj.set('permissions_source', direct_source);
			}
		}
	}
	callback.call(subj);
}

/**
 * Inherits access from any streams specified in the inheritAccess field.
 * It consists of a JSON-encoded array, containing arrays of the forms:
 * [publisherId, streamName]
 * [publisherId, streamName, [readLevel, writeLevel, adminLevel]]
 * [publisherId, streamName, [readLevel, writeLevel, adminLevel], [permission1, permission2]]
 * @method inheritAccess
 * @param callback=null {function}
 *	Callback receives "error" and boolean as arguments - whether the access potentially changed.
 */
Sp.inheritAccess = function (callback) {
	if (!callback) {
		return;
	}
	var subj = this;
	var asUserId = subj.get('asUserId', '');
	if (asUserId === this.fields.publisherId) {
		callback.call(this, null, false);
	}
	if (!this.fields.inheritAccess) {
		callback.call(this, null, false);
	}
	var inheritAccess;
	try {
		inheritAccess = JSON.parse(this.fields.inheritAccess);
	} catch (e) {
		return callback.call(subj, e);
	}
	if (this.get('inheritedAccess') == this.fields.inheritAccess) {
		return callback.call(subj, null, false);
	}
	this.set('inheritAccess', this.fields.inheritAccess);

	var public_source = Streams.ACCESS_SOURCES['public'];
	var contact_source = Streams.ACCESS_SOURCES['contact'];
	var participant_source = Streams.ACCESS_SOURCES['participant'];
	var direct_source = Streams.ACCESS_SOURCES['direct'];
	var inherited_public_source = Streams.ACCESS_SOURCES['inherited_public'];
	var inherited_contact_source = Streams.ACCESS_SOURCES['inherited_contact'];
	var inherited_participant_source = Streams.ACCESS_SOURCES['inherited_participant'];
	var inherited_direct_source = Streams.ACCESS_SOURCES['inherited_direct'];
	var direct_sources = [inherited_direct_source, direct_source];
	
	var readLevel = this.get('readLevel', 0);
	var writeLevel = this.get('writeLevel', 0);
	var adminLevel = this.get('adminLevel', 0);
	var permissions = this.get('permissions', []);
	var readLevel_source = this.get('readLevel_source', public_source);
	var writeLevel_source = this.get('writeLevel_source', public_source);
	var adminLevel_source = this.get('adminLevel_source', public_source);
	var permissions_source = this.get('permissions_source', public_source);
	
	// '[]' (left by PHP's inheritAccessUnset) or a list with no valid entry
	// inherits nothing. Q.Pipe with no requirements never fires, so answer
	// here, or the caller waits forever (ro#1172 fix-review, R06).
	if (!Q.isArrayLike(inheritAccess) || !inheritAccess.some(Q.isArrayLike)) {
		return callback.call(subj, null, false);
	}
	var pipe = new Q.Pipe(inheritAccess.map(JSON.stringify), function (params) {
		subj.set('readLevel', readLevel);
		subj.set('writeLevel', writeLevel);
		subj.set('adminLevel', adminLevel);
		subj.set('readLevel_source', readLevel_source);
		subj.set('writeLevel_source', writeLevel_source);
		subj.set('adminLevel_source', adminLevel_source);
		callback.call(subj, null, true); // something could change...
	});
	
	// Inheritance only goes one "generation" here.
	// To implement several "generations" of inheritance, you can do things like:
	// 'inheritAccess': [["publisherId","grandparentStreamName"],
	//                  ["publisherId","parentStreamName"]]
	Q.each(inheritAccess, function (i, ia) {
		var key = JSON.stringify(ia);
		if (!Q.isArrayLike(ia)) {
			// Skipped, but its pipe slot must still be filled (R06).
			return pipe.fill(key)(null, false);
		}
		var publisherId = ia[0];
		var name = ia[1];
		var accessLevels = ia[2];
		var permissions = ia[3];
		Streams.fetchOne(asUserId, publisherId, name, 
		function (err, stream) {
			// A missing parent row comes back as (null, null). Reading it threw
			// inside this DB callback, which exits the process (ro#1172 audit,
			// R04). Fail closed instead.
			if (err || !stream) {
				return callback.call(subj, err || new Error(
					"Streams.Stream.inheritAccess: inherited stream "
					+ publisherId + "/" + name + " not found"
				));
			}
			// Inherit read, write and admin levels
			// But once we obtain a level via a
			// direct_source or inherited_direct_source,
			// we don't override it anymore.
			var s_readLevel = stream.get('readLevel', 0);
			var s_writeLevel = stream.get('writeLevel', 0);
			var s_adminLevel = stream.get('adminLevel', 0);
			var s_permissions = stream.get('permissions', []);
			var s_readLevel_source = stream.get('readLevel_source', public_source);
			var s_writeLevel_source = stream.get('writeLevel_source', public_source);
			var s_adminLevel_source = stream.get('adminLevel_source', public_source);
			var s_permissions_source = stream.get('permissions_source', public_source);

			var readLevelCap, writeLevelCap, adminLevelCap;
			if (Array.isArray(accessLevels)) {
				readLevelCap = accessLevels[0];
				writeLevelCap = accessLevels[1];
				adminLevelCap = accessLevels[2];
			}
			if (Array.isArray(permissions)) {
				s_permissions = s_permissions.filter(function (permission) {
					return permissions.indexOf(permission) >= 0;
				});
			}

			var ips = inherited_public_source;
			var min;
			if (direct_sources.indexOf(readLevel_source) < 0) {
				min = readLevelCap >= 0 ? Math.min(s_readLevel, readLevelCap) : s_readLevel;
				readLevel = (s_readLevel_source === direct_source)
					? min : Math.max(readLevel, min);
				readLevel_source = s_readLevel_source
				+ (s_readLevel_source > ips ? 0 : ips);
			}
			if (direct_sources.indexOf(writeLevel_source) < 0) {
				min = writeLevelCap >= 0 ? Math.min(s_writeLevel, writeLevelCap) : s_writeLevel;
				writeLevel = (s_writeLevel_source === direct_source)
				? min : Math.max(writeLevel, min);
				writeLevel_source = s_writeLevel_source
				+ (s_writeLevel_source > ips ? 0 : ips);
			}
			if (direct_sources.indexOf(adminLevel_source) < 0) {
				min = adminLevelCap >= 0 ? Math.min(s_adminLevel, adminLevelCap) : s_adminLevel;
				adminLevel = (s_adminLevel_source === direct_source)
				? min : Math.max(adminLevel, min);
				adminLevel_source = s_adminLevel_source
				+ (s_adminLevel_source > ips ? 0 : ips);
			}
			if (direct_sources.indexOf(permissions_source) < 0) {
				var permissions2 = s_permissions;
				if (s_permissions_source !== direct_source) {
					var permissions = stream.get('permissions', []);
					permissions2 = [].concat(permissions);
					for (var i=0; i<permissions.length; ++i) {
						if (permissions2.indexOf(permissions[i]) < 0) {
							permissions2.push(permissions[i]);
						}
					}
				}
				stream.set('permissions', permissions2);
				stream.set('permissions_source', permissions_source);
			}
			pipe.fill(key)(null, true);
		});
	});
};

/**
 * Verifies wheather Stream can be read. Can be called syncronously and in such case skips
 * verification of inherited access or asyncronously to make ful check
 * @method testReadLevel
 * @param {string|integer} level
 *	String describing the level (see Streams.READ_LEVEL) or integer
 * @param callback=null {function}
 *	Callback receives "error" and boolean as arguments - whether the access is granted.
 * @return {Boolean}
 */
Sp.testReadLevel = function(level, callback) {
	return testLevel (this, 'readLevel', 'READ_LEVEL', level, callback);
};
/**
 * Verifies wheather Stream can be written. Can be called syncronously and in such case skips
 * verification of inherited access or asyncronously to make ful check
 * @method testWriteLevel
 * @param {String|integer} level
 *	String describing the level (see Streams.WRITE_LEVEL) or integer
 * @param callback=null {function}
 *	Callback receives "error" and boolean as arguments - whether the access is granted.
 * @return {Boolean}
 */
Sp.testWriteLevel = function(level, callback) {
	return testLevel (this, 'writeLevel', 'WRITE_LEVEL', level, callback);
};
/**
 * Verifies wheather Stream can be administered. Can be called syncronously and in such case skips
 * verification of inherited access or asyncronously to make ful check
 * @method testAdminLevel
 * @param {String|integer} level
 *	String describing the level (see Streams.ADMIN_LEVEL) or integer
 * @param callback=null {function}
 *	Callback receives "error" and boolean as arguments - whether the access is granted.
 * @return {Boolean}
 */
Sp.testAdminLevel = function(level, callback) {
	return testLevel (this, 'adminLevel', 'ADMIN_LEVEL', level, callback);
};
/**
 * Verifies whether the user has all of the given permissions
 * @method testPermission
 * @param {String|Array} permission The name(s) of the permission(s)
 * @param callback=null {function}
 *	Callback receives "error" and boolean as arguments - whether the access is granted.
 * @return {Boolean}
 */
Sp.testPermission = function(permission, callback)
{
	if (Q.isArrayLike(permission)) {
		for (var i=0, l=permission.length; i<l; ++i) {
			if (!this.testPermission(permission[i])) {
				return false
			}
		}
		return true;
	}
	if (subj.publishedByFetcher) {
		callback && callback.call(subj, null, true);
		return true;
	}
	if (subj.fields.closedTime && level !== 'close' && !subj.testWriteLevel('close')) {
		// Answer an asynchronous caller too: returning without calling back
		// left callers waiting forever (ro#1172 fix-review, R06).
		callback && callback.call(subj, null, false);
		return false;
	}
	var permissions = subj.get('permissions', []);
	if (permissions.indexOf(permission) >= 0) {
		return true;
	}
	var permissionsSource = subj.get('permissions_source', 0);
	if (permissionsSource === Streams.ACCESS_SOURCES['direct'] ||
		permissionsSource == Streams.ACCESS_SOURCES['inherited_direct']) {
		callback && callback.call(subj, null, false);
		return false;
	}
	callback && subj.inheritAccess(function(err, res) {
		if (err) {
			callback.call(subj, err);
		} else if (!res) {
			callback.call(subj, null, false);
		} else {
			var permissions = subj.get('permissions', []);
			var result = (permissions.indexOf(permission) >= 0);
			callback && callback.call(subj, null, result);
		}
	});
	return false;
}

Sp._fetchAsUser = function (options, callback) {
	var stream = this;
	var pfx = 'Streams.prototype.fetchAsUser: ';
	if (!options.userId) {
		return callback.call(stream, new Error(pfx+"No user id provided"));
	}
	var user = new Users.User({ id: options.userId });
	user.retrieve(function (err, users) {
		if (err) return callback.call(stream, err);
		if (!users.length) return callback.call(stream, new Error(pfx+"User not found"));
		var user = users[0];
		if (user.fields.id === stream.get('asUserId', null)) {
			return callback.call(stream, null, stream, user.fields.id, user);
		}
		Streams.fetch(user.fields.id, stream.fields.publisherId, stream.fields.name,
		function(err, streams) {
			if (err) {
				return callback.call(stream, err);
			}
			if (!streams[stream.fields.name]) {
				return callback.call(stream, new Error(pfx+"Stream not found"));
			}
			callback.call(stream, null, streams[stream.fields.name], user.fields.id, user);
		});
	});
};

/**
 * If the user is not participating in the stream yet,
 * inserts a participant record and posts a "Streams/joined" type message to the stream.
 * Otherwise update timestamp
 * @method join
 * @param options={} {object}
 *  An associative array of options. 'userId' is mandatory. The keys can be:<br/>
 *  "subscribed" => boolean<br/>
 *  "posted" => boolean<br/>
 *  "reputation" => integer<br/>
 *  "reason" => string<br/>
 *  "enthusiasm" => decimal<br/>
 *  "userId" => The user who is joining the stream.
 * @param callback {function} receives error if any and participant object as arguments
 */
Sp.join = function(options, callback) {
	var stream = this;
	if (typeof options === "function") {
		callback = options;
		options = {};
	}
	this._fetchAsUser(options, function(err, stream, userId) {
		if (err) return callback.call(stream, err);
		if (!stream.testWriteLevel('join')) return callback.call(stream, new Error("User is not authorized"));
		new Streams.Participant({
			publisherId: stream.fields.publisherId,
			streamName: stream.fields.name,
			userId: userId
		}).retrieve(function(err, sp) {
			if (err) return callback.call(stream, err);
			var type = 'Streams/joined';
			if (sp.length) {
				sp = sp[0];
				var save = false, subscribed = options.subscribed;
				var yn = subscribed ? 'yes' : 'no';
				if (subscribed && sp.fields.subscribed !== yn) {
					sp.fields.subscribed = yn;
					save = true;
				}
				if (sp.fields.state === 'participating') {
					type = 'Streams/visited';
				}
				if (sp.fields.state === 'participating') {
					sp.fields.state = 'participating';
					save = true;
				}
				if (save) {
					sp.save(true, _afterSaveParticipant);
				} else {
					_afterSaveParticipant();
				}
			} else {
				sp = new Streams.Participant({
					publisherId: stream.fields.publisherId,
					streamName: stream.fields.name,
					userId: userId,
					streamType: stream.fields.type,
					subscribed: options.subscribed ? 'yes' : 'no',
					posted: options.posted ? 'yes' : 'no',
					reputation: options.reputation || 0,
					state: 'participating',
					extra: options.extra || '{}'
				});
				sp.save(_afterSaveParticipant);
			}
			function _afterSaveParticipant(err) {
				if (err) return callback.call(stream, err);
				Users.Socket.emitToUser(userId, 'Streams/joined', sp.fillMagicFields().getFields());
				stream.updateParticipantCounts(
					'participating', sp.fields.state, _afterUpdateParticipantCounts
				);
			}
			function _afterUpdateParticipantCounts() {
				var f = sp.fields;
				stream.post(userId, {
					type: type,
					instructions: JSON.stringify({
						reason: f.reason,
						enthusiasm: f.enthusiasm
					})
				}, function(err) {
					if (err) return callback.call(stream, err);
					new Streams.Stream({
						publisherId: userId,
						name: 'Streams/participating'
					}).retrieve(function (err, pstream) {
						if (err || !pstream.length) return callback.call(stream, err);
						pstream[0].post(userId, {
							type: type+'ed',
							content: '',
							instructions: JSON.stringify({
								publisherId: stream.fields.publisherId,
								streamName: stream.fields.name
							})
						}, function (err) {
							if (err) return callback.call(stream, err);
							callback.call(stream, null, sp);
						});
					});
				});
			}
		});
	});
};

Sp.leave = function(options, callback) {
	// TODO: Nazar: Implement to be similar to PHP, and add documentation
	//callback(); // pass err

    var stream = this;
    if (typeof options === "function") {
        callback = options;
        options = {};
    }
    this._fetchAsUser(options, function(err, stream, userId) {
        if (err) return callback.call(stream, err);
        //if (!stream.testWriteLevel('join')) return callback.call(stream, new Error("User is not authorized"));
        new Streams.Participant({
            publisherId: stream.fields.publisherId,
            streamName: stream.fields.name,
            userId: userId
        }).retrieve(function(err, sp) {
            if (err) return callback.call(stream, err);
            var type = 'Streams/left';
            if (sp.length) {
                sp = sp[0];
                var save = false, subscribed = options.subscribed;
                if (subscribed && sp.fields.subscribed == 'yes') {
                    sp.fields.subscribed = 'no';
                    save = true;
                }

                if (sp.fields.state === 'participating') {
                    sp.fields.state = 'left';
                    save = true;
                }
                if (save) {
                    sp.save(true, _afterSaveParticipant);
                } else {
                    _afterSaveParticipant();
                }
            }
            function _afterSaveParticipant(err) {
                if (err) return callback.call(stream, err);
                Users.Socket.emitToUser(userId, 'Streams/left', sp.fillMagicFields().getFields());
                stream.updateParticipantCounts(
                    'left', sp.fields.state, _afterUpdateParticipantCounts
                );
            }
            function _afterUpdateParticipantCounts() {
                var f = sp.fields;
                stream.post(userId, {
                    type: type,
                    instructions: JSON.stringify({
                        reason: f.reason,
                        enthusiasm: f.enthusiasm
                    })
                }, function(err) {
                    if (err) return callback.call(stream, err);
                    new Streams.Stream({
                        publisherId: userId,
                        name: 'Streams/participating'
                    }).retrieve(function (err, pstream) {
                        if (err || !pstream.length) return callback.call(stream, err);
                        pstream[0].post(userId, {
                            type: type,
                            content: '',
                            instructions: JSON.stringify({
                                publisherId: stream.fields.publisherId,
                                streamName: stream.fields.name
                            })
                        }, function (err) {
                            if (err) return callback.call(stream, err);
                            callback.call(stream, null, sp);
                        });
                    });
                });
            }
        });
    });
};

/**
 * Subscribe to the stream's messages<br/>
 *	If options are not given check the subscription templates:
 *	<ol>
 *		<li>exact stream name and exact user id</li>
 *		<li>generic stream name and exact user id</li>
 *		<li>exact stream name and generic user</li>
 *		<li>generic stream name and generic user</li>
 *	</ol>
 *	default is to subscribe to ALL messages.<br/>
 *	If options supplied - skip templates and use options<br/><br/>
 * Using subscribe if subscription is already active will modify existing
 * subscription - change type(s) or modify notifications
 * @method subscribe
 * @param {object} [options={}]
 * @param {array} [options.filter] optional array with two keys
 * @param {Array} [options.filter.types] array of message types, if this is empty then subscribes to all types
 * @param {integer} [options.filter.notifications=0] limit number of notifications, 0 means no limit
 * @param {datetime} [options.untilTime=null] time limit, if any for subscription
 * @param {datetime} [options.readyTime] time from which user is ready to receive notifications again
 * @param {String} [options.userId] the user subscribing to the stream. Defaults to the logged in user.
 * @param {array} [options.rule=array()] optionally override the rule for new subscriptions
 * @param {array} [options.rule.deliver=array('to'=>'default')] under "to" key,
 *   named the field under Streams/rules/deliver config, which will contain the names of destinations,
 *   which can include "email", "mobile", "email+pending", "mobile+pending"
 * @param {datetime} [options.rule.readyTime] time from which user is ready to receive notifications again
 * @param {array} [options.rule.filter] optionally set a filter for the rules to add
 * @param {boolean} [options.skipRules] if true, do not attempt to create rules for new subscriptions
 * @return {Streams_Subscription|false}
 */
Sp.subscribe = function(options, callback) {

	var stream = this;
	if (typeof options === "function") {
		callback = options;
		options = {};
	}
	options = options || {};
	this._fetchAsUser(options, function(err, stream, userId, user) {
		if (err) return callback.call(stream, err);
		stream.join({
			subscribed: true,
			userId: userId
		}, function (err) {
			if (err) return callback.call(stream, err);
			new Streams.Subscription({
				publisherId: stream.fields.publisherId,
				streamName: stream.fields.name,
				ofUserId: userId
			}).retrieve(function(err, s) {
				if (err) {
					return callback.call(stream, err);
				}
				if (s.length) {
					s = s[0];
				} else {
					s = new Streams.Subscription({
						publisherId: stream.fields.publisherId,
						streamName: stream.fields.name,
						ofUserId: userId
					});
				}
				stream.getSubscriptionTemplate('Subscription', userId,
				function (err, template) {
					if (err) return callback.call(stream, err);
					var filter = options.filter || (template 
						? JSON.parse(template.fields.filter)
						: Streams_Stream.getConfigField(
							stream.fields.type,
							['subscriptions', 'filter'],
							{ 
								types: [
									"^(?!(Users/)|(Streams/)).*/", 
									"Streams/relatedTo", 
									"Streams/chat/message"
								], 
								notifications: 0
							}
						));
					s.fields.filter = JSON.stringify(filter);
					if (options.untilTime != undefined) {
						s.fields.untilTime = options.untilTime;
					} else {
						if (template && template.templateType > 0
						&& template.fields.duration > 0) {
							var d = template.fields.duration;
							s.fields.untilTime = new Db.Expression(
								'CURRENT_TIMESTAMP + INTERVAL ' + d + ' SECOND'
							);
						}
					}
					s.save(true, function (err) {
						if (err) return callback.call(stream, err);
						// Now let's handle rules
						if (options.skipRules) {
							return callback.call(stream, null, s);
						}
						// insert up to one rule per subscription
						var rule = {
							ofUserId: userId,
							publisherId: stream.fields.publisherId,
							streamName: stream.fields.name,
							readyTime: new Db.Expression('CURRENT_TIMESTAMP'),
							filter: '{"types":[],"labels":[]}',
							deliver: '{"to": "default"}',
							relevance: 1
						};
						if (options.rule) {
							Q.extend(rule, options.rule);
							var db = Streams.Subscription.db();
							if (options.rule.readyTime) {
								rule.readyTime = db.toDateTime(rule.readyTime);
							}
							if (rule.filter && typeof rule.filter !== 'string') {
								rule.filter = JSON.stringify(rule.filter);
							}
							if (rule.deliver && typeof rule.deliver !== 'string') {
								rule.deliver = JSON.stringify(rule.deliver);
							}
							_insertRule(rule);
						} else {
							stream.getSubscriptionTemplate('SubscriptionRule', userId,
							function (err, template) {
								if (err) return callback.call(stream, err);
								if (template && template.templateType !== 0) {
									rule.deliver = template.fields.deliver;
									rule.filter = template.fields.filter;
								}
								_insertRule(rule);
							});
						}
						function _insertRule(fields) {
							new Streams.SubscriptionRule(fields).save(function(err) {
								if (err) {
									return callback.call(stream, err);
								}
								_postSubscribeMessage();
							});
						}
						function _postSubscribeMessage() {
							stream.post(userId, {
								type: 'Streams/subscribed'
							}, function(err) {
								if (err) {
									return callback.call(stream, err);
								}
								_postSubscribedMessage();
							});
						}
						function _postSubscribedMessage() {
							new Streams.Stream({
								publisherId: userId,
								name: 'Streams/participating'
							}).retrieve(function (err, pstream) {
								if (err || !pstream.length) {
									return callback.call(stream, err);
								}
								pstream[0].post(userId, {
									type: 'Streams/subscribed',
									instructions: JSON.stringify({
										publisherId: stream.fields.publisherId,
										streamName: stream.fields.name
									})
								}, function (err) {
									if (err) return callback.call(stream, err);
									callback.call(stream, null, s);
								});
							});
						}
					});
				});
			});
		});
	});
};

Sp.unsubscribe = function(options, callback) {
	// TODO: Nazar: Implement to be similar to PHP, and add documentation
	callback(); // pass err
};

/**
 * Notify participants of the stream depending on user status.
 * Set the "Streams/notifications/onlyIfAllClientsOffline" config field to false
 * to send offline notifications whenever all clients related to device sessions
 * are offline, even if other clients are online.
 * @method notify
 * @param {Streams_Participant} participant The stream participant to notify
 * @param {String} event The type of Streams event, such as "post" or "remove"
 * @param {Streams_Message|Steams_Ephemeral} messageOrEphemeral pass a message with instructions or ephemeral with payload
 * @param {Function} [callback] This would be called after all the notifying was done
 * @param {Object} [accessView] The participant's access, already calculated by
 *   Streams.Stream.calculateAccessForUsers(). Otherwise it is calculated here.
 * @param {Object} [accessDecision] Internal: {err, allowed} when the caller has
 *   already tested the read level on accessView.
 */
Sp.notify = function(participant, event, messageOrEphemeral, callback, accessView, accessDecision) {
	var stream = this;
	var userId = participant.fields.userId;
	function _notify(err, access) {
		if (err) {
		    return callback && callback(err);
		}
		if (!access) {
			return;
		}
		
		// 1) check for socket clients which are online
		var only = stream.getAttribute(['Streams', 'notifications', 'onlyIfAllClientsOffline']);
		if (only == undefined) {
			only = Q.Config.get(['Streams', 'notifications', 'onlyIfAllClientsOffline'], true);
		}
		if (only) {
			// should we notify even if a user has a client online
			var evenIfOnline = Streams.Stream.getConfigField(stream.fields.type, ['messages', messageOrEphemeral.getType(), 'evenIfOnline'], false);
			// check if any socket clients are online
			var clients = Users.User.clientsOnline(userId);

			_continue(!Q.isEmpty(clients), evenIfOnline);
		} else {
			// check if any socket clients associated to any device sessions are online
			_devices(_continue);
		}
		function _continue(online, evenIfOnline) {
			var p = Object.getPrototypeOf(messageOrEphemeral);
			// 2) if user has socket connected - emit socket message and quit
			if (online) {
				Users.Socket.emitToUser(userId, event, messageOrEphemeral.getFields(), {
					publisherId: stream.fields.publisherId,
					streamName: stream.fields.name,
					streamType: stream.fields.type,
					messageCount: stream.fields.messageCount
				});

				if (!evenIfOnline) {
					return callback && callback();
				}
			}
			var p = Object.getPrototypeOf(messageOrEphemeral);
			if (p.className === 'Streams_Ephemeral') { // a Streams_Ephemeral
				return callback && callback(null, false);
			}
			// 3) if user has no socket connected, send offline notifications
			//      to users who subscribed and filters match
			/*
				// we used to not notify the user of his own actions.
				// actually, we do need the user's browsers to update too
				// so messages generated by their own actions should still arrive
				if (userId === message.fields.byUserId) {
					return; // no need to notify the user of their own actions
				}
			*/ 
			if (participant.fields.subscribed !== 'yes') {
				return callback && callback(null, []);
			}

			// don't send offline notifications if paused
			if (Streams.Notification.paused) {
				return false;
			}

			// The offline path costs several queries, an avatar fetch and a
			// rendered delivery per participant. It runs through a process-wide
			// limit, from a module-level function so that a queued task holds
			// only a few strings and the shared stream and message, not this
			// participant's row and closures (ro#1172).
			_offlineNotify(stream, messageOrEphemeral, userId,
				participant.fields.publisherId, participant.fields.streamName, callback);
		}
		
		function _devices() {
			var app = Q.app.name;
			var appIds = Q.Config.get(['Streams', 'notifications', 'appIds'], null);
			if (appIds === null) {
				appIds = {};
				var platforms = Q.Config.expect(['Users', 'apps', 'platforms']);
				platforms.forEach(function (platform) {
					var p = Users.appInfo(platform, app);
					if (p.appId) {
						appIds[platform] = [p.appId];
					}
				});
			}
			Users.User.devices(userId, appIds, function (devices) {
				for (var platform in devices) {
					for (var i=0; i<devices[platform].length; i++) {
						var d = devices[platform][i];
						var clients = Users.User.clientsOnline(userId, d[i].sessionId);
						if (!Q.isEmpty(clients)) {
							return _continue(true);
						}
					}
				}
				_continue(false);
			});
		}
	}
	// check access
	var t = messageOrEphemeral.getType();
	var readLevel = (
		t === 'Streams/left' ||
		t === 'Streams/joined'
	) ? 'participants' : 'messages';
	// Access is decided on a per-participant view, never on the shared stream
	// (ro#1172). This used to call this.calculateAccess(userId) on the stream
	// itself, and notifyParticipants ran it for every participant at once on
	// the same object: each call reset the levels while others' queries were
	// still in flight, _setStreamAccess only ever raises a level, and the
	// publisher's turn set publishedByFetcher for good — so one participant's
	// access could be read as another's.
	if (accessView && accessView.get('asUserId') === userId) {
		if (accessDecision) {
			return _notify(accessDecision.err, accessDecision.allowed);
		}
		return accessView.testReadLevel(Streams.READ_LEVEL[readLevel], _notify);
	}
	Streams_Stream.accessView(this).calculateAccess(userId, function (err) {
		if (err) return callback && callback(err);
		this.testReadLevel(Streams.READ_LEVEL[readLevel], _notify);
	});
};

/**
 * Fetch participants of the stream. Does testReadLevel('participants')
 *
 * @method getParticipants
 * @param {Object} [options={}] Options to control fetching
 * @param {String} [options.state] Filter by participant state:
 *   "invited", "participating", or "left"
 * @param {Number} [options.limit=1000000] Maximum number of participants to return
 * @param {Number} [options.offset=0] Offset for pagination
 * @param {Boolean} [options.ascending=false]
 *   If true, sort by insertedTime ascending, else descending
 * @param {Boolean} [options.skipAccess=false]
 *   Pass true to skip checking readLevel
 * @param {Boolean} [options.skipFiltering=false]
 *   If true, skip Users/filter/users hook
 * @param {Boolean} [options.skipLimiting=false]
 *   If true, do not cap limit using config getParticipantsLimit
 * @param {Function} callback
 *   Callback receives (err, participants)
 * @return {void}
 * @throws {Error} If access is denied or invalid state is provided
 */
Sp.getParticipants = function (options, callback) {
	var stream = this;

	if (typeof options === "function") {
		callback = options;
		options = {};
	}
	options = options || {};

	// Access check (parity with PHP)
	if (!options.skipAccess && !stream.testReadLevel('participants')) {
		return callback && callback(new Error("Not authorized to read participants"), []);
	}

	var criteria = {
		publisherId: stream.fields.publisherId,
		streamName: stream.fields.name
	};

	if (options.state) {
		var allowed = ['invited', 'participating', 'left'];
		if (allowed.indexOf(options.state) < 0) {
			return callback && callback(new Error(
				'Invalid state, must be one of "' + allowed.join('", "') + '"'
			));
		}
		criteria.state = options.state;
	}

	var q = Streams.Participant.SELECT('*').where(criteria);

	var limit = options.limit != null ? options.limit : 1000000;
	var offset = options.offset || 0;

	if (!options.skipLimiting) {
		var max = Streams_Stream.getConfigField(
			stream.fields.type,
			['getParticipantsLimit'],
			100
		);
		limit = Math.min(limit, max);
	}

	q.limit(limit, offset);

	q.orderBy(
		'insertedTime',
		options.ascending === true
	);

	q.execute(function (err, rows) {
		if (err) {
			return callback && callback(err);
		}

		var participants = {};
		for (var i = 0; i < rows.length; i++) {
			var r = rows[i];
			participants[r.fields.userId] = r;
		}

		if (options.skipFiltering) {
			return callback && callback(null, participants);
		}

		var userIds = Object.keys(participants);

		var filtered = {};
		for (var j = 0; j < userIds.length; j++) {
			var uid = userIds[j];
			if (participants[uid]) {
				filtered[uid] = participants[uid];
			}
		}

		callback && callback(null, filtered);
	});
};

/**
 * Fetch a particular participant in the stream, if it exists.
 * Meant to be called internally. Doesn't perform access checks.
 *
 * @method getParticipant
 * @param {String} [userId]
 *   The id of the user to fetch. Defaults to logged-in user.
 * @param {Function} callback
 *   Callback receives (err, participant|null)
 * @return {void}
 *
 * @throws {Error} If access is denied or user cannot be determined
 */
Sp.getParticipant = function (userId, callback) {
	var stream = this;

	if (typeof userId === "function") {
		callback = userId;
		userId = null;
	}

	if (!userId) {
		var u = Users.loggedInUser && Users.loggedInUser(true);
		if (!u) {
			return callback && callback(new Error("No userId provided"));
		}
		userId = u.id;
	}

	Streams.Participant.SELECT('*').where({
		publisherId: stream.fields.publisherId,
		streamName: stream.fields.name,
		userId: userId
	}).limit(1).execute(function (err, rows) {
		if (err) return callback && callback(err);
		callback && callback(null, rows.length ? rows[0] : null);
	});
};

/**
 * Retrieve socket clients observing the stream.
 * Meant to be called internally. Doesn't perform access checks.
 * Observers are clients (not necessarily users) subscribed via sockets,
 * typically through "Streams/join" events.
 *
 * @method getObservers
 * @param {Function} callback
 *   Callback receives (err, observers)
 *   where observers is a map: {clientId: socketClient}
 * @return {void}
 *
 * @throws {Error} If access is denied
 */
Sp.getObservers = function (callback) {
	var stream = this;

	// Access check (observers can receive messages → messages-level access)
	if (!stream.testReadLevel('messages')) {
		return callback && callback(new Error("Not authorized to read observers"));
	}

	var observers = Q.getObject(
		[stream.fields.publisherId, stream.fields.name],
		Streams.observers
	);

	callback && callback(null, observers || {});
};

/**
 * Posts a message to the stream.
 * @method post
 * Currently this is not nearly as robust as the PHP method,
 * and doesn't perform any access checks, so it is only
 * meant to be called internally.
 * @param {String} byUserId
 *  The user to post as
 * @param fields {Object}
 * @param callback=null {function}
 */
Sp.post = function (byUserId, fields, callback) {
	if (typeof byUserId !== 'string') {
		callback = fields;
		fields = byUserId;
		byUserId = fields && fields.byUserId;
		if (!byUserId) {
			throw new Q.Exception("Streams.Stream.prototype.post needs byUserId");
		}
	}
	Streams.Message.post(Q.extend({
		publisherId: this.fields.publisherId,
		streamName: this.fields.name,
		byUserId: byUserId
	}, fields), callback);
};

/**
 * Returns the canonical url of the stream, if any
 * This function can use the Streams.Stream object's fields.
 * You can use strings in the config "url" parameter, that follow Handlebars usage,
 * and use double-curly-braces to enclose expressions like baseUrl, name, and attributes.foo.bar
 * See more at https://handlebarsjs.com/guide/expressions.html#basic-usage
 * @param {Integer} [messageOrdinal] pass this to link to a message in the stream, e.g. to highlight it
 * @param {String} [baseUrl] you can override the default found in "Q"/"web"/"appRootUrl" config
 * @return {String|null|false}
 */
Sp.url = function (messageOrdinal, baseUrl)
{
	var url = Streams_Stream.getConfigField(this.fields.type, 'url', null);
	if (!url) {
		return null;
	}
	var urlString = Q.Handlebars.renderSource(url, Q.extend(
		{},
		this.fields, 
		this.getAllAttributes(),
		{
			streamName: this.fields.name.split('/'),
			nameNormalized: Q.normalize(this.fields.name),
			baseUrl: baseUrl || Q.Request.baseUrl()
		}
	));
	var sep = urlString.indexOf('?') >= 0 ? '&' : '?';
	var qs = messageOrdinal ? sep+messageOrdinal : "";
	return Q.url(urlString + qs);
};

/**
 * Returns the canonical URI of the stream, if any
 * @param {Integer} [messageOrdinal] pass this to link to a message in the stream, e.g. to highlight it
 * @return {String|null|false}
 */
Sp.uri = function (messageOrdinal)
{
	var uri = Streams_Stream.getConfigField(this.fields.type, 'uri', null);
	if (!uri) {
		return null;
	}
	var uriString = Q.Handlebars.renderSource(uri, {
		publisherId: this.fields.publisherId,
		streamName: this.fields.name.split('/'),
		name: this.fields.name
	});
	var parts = uriString.split(' ');
	var qs = messageOrdinal ? '?'+messageOrdinal : "";
	return parts.shift() + qs + ' ' + (parts.length ? parts.join(' ') : '');
};

/**
 * Find out whether a certain field is restricted from being
 * edited by clients via the regular Streams REST API.
 * @method restrictedFromClient
 * @static
 * @param {String} streamType
 * @param {String} fieldName
 * @param {String} [whenCreating=false]
 * @return {Boolean}
 */
Streams_Stream.restrictedFromClient = function Streams_Stream_restrictedFromClient(
	streamType, fieldName, whenCreating
) {
	var during = whenCreating ? 'create' : 'edit';
	var info = Streams_Stream.getConfigField(streamType, during, false);
	if (!info) {
		return true;
	}
	if (Q.isArrayLike(info) && info.indexOf(fieldName) < 0) {
		return true;
	}
	return false;
};

/**
 * A short "publisherId/streamName (type)" label for log lines, safe to call on a
 * partially-constructed stream. Used by the notify* methods so that a delivery
 * failure names the stream it failed on.
 * @method logId
 * @static
 * @param {Streams_Stream} [stream]
 * @return {String}
 */
Streams_Stream.logId = function Streams_Stream_logId(stream) {
	var f = stream && stream.fields;
	if (!f) {
		return '(unknown stream)';
	}
	return (f.publisherId || '?') + '/' + (f.name || '?')
		+ (f.type ? ' (' + f.type + ')' : '');
};

/**
 * Render an error for a log line without assuming it is an Error instance —
 * the Db layer and socket.io both hand back plain strings and plain objects.
 * Keeps the stack when there is one, because the DB errors this exists for
 * ("Can't add new command when connection is in closed state") are otherwise
 * indistinguishable from each other in the log.
 * @method describeError
 * @static
 * @param {Error|String|Object} err
 * @return {String}
 */
Streams_Stream.describeError = function Streams_Stream_describeError(err) {
	if (err == null) {
		return '(no error given)';
	}
	if (err instanceof Error) {
		return (err.code ? '[' + err.code + '] ' : '') + (err.stack || err.message);
	}
	if (typeof err === 'string') {
		return err;
	}
	try {
		return JSON.stringify(err);
	} catch (e) {
		return String(err);
	}
};

// Offline notification for one participant who may read the message, has no
// client online and is subscribed: subscription rules, avatar, deliveries and
// the Streams_Notification row. Queued through _offlineSlot (ro#1172); kept at
// module level so a queued task retains only its arguments.
function _offlineNotify(stream, messageOrEphemeral, userId,
	participantPublisherId, participantStreamName, callback
) {
	var _finish;
	_offlineSlot(function (release) {
		_finish = function () {
			release();
			callback && callback.apply(this, arguments);
		};
		Streams.Subscription.test(userId, stream, messageOrEphemeral.getType(), _continue2);
	});
	function _continue2(err, deliveries) {
		var message = messageOrEphemeral;
		if (err || !deliveries.length) {
			return _finish(err);
		}
		var waitingFor = deliveries.map(function(d) { return JSON.stringify(d); });
		var p = new Q.Pipe(waitingFor, function(params) {
			for (var d in params) {
				if (params[d][0]) {
					return _finish(params[d][0]);
				}
			}
			new Streams.Notification({
				userId: userId,
				publisherId: participantPublisherId,
				streamName: participantStreamName,
				messageOrdinal: message.fields.ordinal,
				type: message.fields.type
			}).save(function(err) {
				_finish(err, deliveries);
			});
		});
		// actually notify according to the deliveriy rules
		var byUserId = message.fields.byUserId;
		Streams.Avatar.fetch(userId, byUserId, function (err, avatar) {
			var logfile = Q.Config.get(
				['Streams', 'types', '*', 'messages', '*', 'log'],
				false
			);
			if (logfile) {
				Q.log({
					messageType: message.fields.type,
					publisherId: stream.fields.publisherId,
					streamName: stream.fields.name,
					deliveries: deliveries,
					displayName: avatar && avatar.displayName()
				}, logfile);
			}
			if (message.fields.type !== "Streams/invited") {
				return deliveries.forEach(function(delivery) {
					message.deliver(stream, userId, delivery, avatar,
						p.fill(JSON.stringify(delivery))
					);
				});
			}
			// This is only for "Streams/invited"
			var instructions = JSON.parse(message.fields.instructions);
			new Streams.Invite({
				token: instructions.token
			}).retrieve(function(err, rows) {
				if (err || !rows.length) {
					return deliveries.forEach(function(delivery) {
						p.fill(JSON.stringify(delivery))(err); 
					});
				}
				var invite = this;
				new Streams.Stream({
					publisherId: invite.fields.publisherId,
					name: invite.fields.streamName
				}).retrieve(function(err, rows2) {
					if (err || !rows2.length) {
						return deliveries.forEach(function(delivery) {
							p.fill(JSON.stringify(delivery))(err); 
						});
					}
					var stream = this;
					try { 
						var instructions = JSON.parse(message.fields.instructions); 
					} catch (e) {}
					var invited = invite.getFields();
					invited.url = invite.url();
					if (instructions && instructions.type) {
						invited[instructions.type] = true;
					}
					stream.invited = invited;
					deliveries.forEach(function(delivery) {
						message.deliver(stream, userId, delivery, avatar,
							p.fill(JSON.stringify(delivery))
						);
					});
				});
			});
		});
	}
	
}

// Process-wide limits on work in flight (ro#1172). Each limiter has
// Streams/notifications/<name>Concurrency (default 10) slots; the rest wait
// in a queue of closures. A slot is released when its task finishes, or after
// Streams/notifications/<name>Timeout seconds (default 60) so a task that
// never calls back cannot stall every later one.
//  - offline: offline notifications to subscribed participants
//  - inherit: access decisions that need inheritAccess (a fetchOne per
//    inherited stream per user)
var _limits = {
	offline: { name: 'offline', active: 0, queue: [] },
	inherit: { name: 'inherit', active: 0, queue: [] }
};

function _offlineSlot(task) {
	_limited(_limits.offline, task);
}

function _limited(limit, task) {
	limit.queue.push(task);
	_limitNext(limit);
}

function _limitNext(limit) {
	var max = parseInt(Q.Config.get(
		['Streams', 'notifications', limit.name + 'Concurrency'], 10
	));
	if (!(max > 0)) {
		max = 10;
	}
	while (limit.active < max && limit.queue.length) {
		_limitRun(limit, limit.queue.shift());
	}
}

function _limitRun(limit, task) {
	var released = false;
	var seconds = parseFloat(Q.Config.get(
		['Streams', 'notifications', limit.name + 'Timeout'], 60
	));
	// A non-numeric or zero timeout would fire at once and void the limit.
	if (!(seconds > 0)) {
		seconds = 60;
	}
	var timer = setTimeout(function () {
		Q.log("Streams.Stream: a " + limit.name + " task was still running after "
			+ seconds + "s; releasing its slot");
		release();
	}, seconds * 1000);
	if (timer.unref) {
		timer.unref();
	}
	limit.active++;
	function release() {
		if (released) {
			return;
		}
		released = true;
		clearTimeout(timer);
		limit.active--;
		// Not synchronously: a task that finishes at once must not recurse
		// through the whole queue on one stack.
		setImmediate(function () {
			_limitNext(limit);
		});
	}
	try {
		task(release);
	} catch (e) {
		Q.log("Streams.Stream: " + limit.name + " task threw: "
			+ Streams_Stream.describeError(e));
		release();
	}
}

// The read level a participant or observer needs to receive this message.
// Throws for a null message, as notify() always has.
function _readLevelFor(messageOrEphemeral) {
	var t = messageOrEphemeral.getType();
	return Streams.READ_LEVEL[
		(t === 'Streams/left' || t === 'Streams/joined') ? 'participants' : 'messages'
	];
}

// Decides whether the user of an access view may read at `level`, calling
// back (err, allowed) at most once. Synchronous when the view's own levels
// answer. When the stream inherits access, the full test (which may fetch
// each inherited stream as that user) runs in an "inherit" slot, so a post to
// a large stream does not start one fetchOne per participant at once.
function _decideRead(view, level, callback) {
	var called = false;
	function done(err, allowed) {
		if (called) {
			return;
		}
		called = true;
		callback(err, allowed);
	}
	if (view.testReadLevel(level)) {
		return done(null, true);
	}
	if (!view.fields.inheritAccess
	|| (view.fields.closedTime && !view.testWriteLevel('close'))) {
		// No inheritance, or a closed stream (testLevel answers it before
		// any inheritance): the synchronous answer is the whole answer, and
		// must not take an "inherit" slot (ro#1172 fix-review, R06).
		return done(null, false);
	}
	_limited(_limits.inherit, function (release) {
		view.testReadLevel(level, function (err, allowed) {
			release();
			done(err, allowed);
		});
	});
}

module.exports = Streams_Stream;
