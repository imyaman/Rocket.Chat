import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';

import { hasPermission } from '../../../authorization/server';
import { callbacks } from '../../../../lib/callbacks';
import { Users } from '../../../models/server';
import { api } from '../../../../server/sdk/api';
import { isMessageEdited } from '../../../../definition/IMessage';

callbacks.add(
	'beforeSaveMessage',
	function (message) {
		// If the message was edited, or is older than 60 seconds (imported)
		// the notifications will be skipped, so we can also skip this validation
		if (isMessageEdited(message) || (message.ts && Date.now() - new Date(message.ts).getTime() > 60000)) {
			return message;
		}

		// Test if the message mentions include @all.
		if (message.mentions?.some(({ _id }) => _id === 'all')) {
			// Check if the user has permissions to use @all in both global and room scopes.
			if (!hasPermission(message.u._id, 'mention-all') && !hasPermission(message.u._id, 'mention-all', message.rid)) {
				// Get the language of the user for the error notification.
				const { language } = Users.findOneById(message.u._id);
				const action = TAPi18n.__('Notify_all_in_this_room', {}, language);

				// Add a notification to the chat, informing the user that this
				// action is not allowed.
				api.broadcast('notify.ephemeralMessage', message.u._id, message.rid, {
					msg: TAPi18n.__('error-action-not-allowed', { action }, language),
				});

				// Also throw to stop propagation of 'sendMessage'.
				throw new Meteor.Error('error-action-not-allowed', 'Notify all in this room not allowed', {
					method: 'filterATAllTag',
					action: 'Notify_all_in_this_room',
				});
			}
		}

		return message;
	},
	1,
	'filterATAllTag',
);
