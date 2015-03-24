/**
Model representing song schema.
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
sampleSchema = new Schema({
	title: String, //required
	songtype: String,
	composer: String, //required
	textauthor: String,
	date: Date,
	work: String, //required if title and composer aren't enough
	genre: String,
	lyrics: {type: Array, default: []},
	language: String,
	recordings: Array,
	translations: {type: Object, default: {}},
	approved: {type: Boolean, default: false},
	credits: {
		audio: {
			userID: Schema.Types.ObjectId,
			source: String,
			approved: {type: Boolean, default: false}
		},
		lyrics: {
			userID: Schema.Types.ObjectId,
			source: String,
			approved: {type: Boolean, default: false}
		},
		translation: {
			userID: Schema.Types.ObjectId,
			source: String,
			approved: {type: Boolean, default: false}
		}
	},	
	dateAdded: {type: Date, default: Date.now},
	comments: String
}, {
	autoIndex: false
});

var songModel = mongoose.model('Song', sampleSchema);

//Combination of title, composer, and work should be unique... can add date if desired
songModel.ensureIndexes({"title": 1, "composer": 1, "work": 1 });

module.exports = {
	model: songModel
};
