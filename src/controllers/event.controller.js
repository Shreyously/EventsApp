import User from '../models/user.model.js';
import Event from '../models/event.model.js';
import cloudinary from '../lib/cloudinary.js';
import { io } from '../index.js';

export const CreateEvent = async (req, res) => {
  const { name, description, date, location, capacity, category, imageUrl } = req.body;
  try {
    // Validate required fields
    if (!name || !description || !date || !location || !category || !capacity || !imageUrl) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Upload image to cloudinary
    const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
      folder: "events",
    });

    // Create new event
    const newEvent = await Event.create({
      name,
      description,
      date,
      location,
      category,
      capacity: Number(capacity), // Convert to number
      imageUrl: uploadResponse.secure_url,
      creator: req.user._id,
      attendees: [] // Initialize empty attendees array
    });

    // Update User's eventsCreated array
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { eventsCreated: newEvent._id } }
    );

    // Populate creator and attendees
    const populatedEvent = await Event.findById(newEvent._id)
      .populate('creator', 'name')
      .populate('attendees', 'name');

    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate('creator', 'name')
      .populate('attendees', 'name _id') // Make sure _id is included
      .sort({ date: 1 });

    console.log('Fetched events with attendees:', events); // Debug log
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('creator', 'name')
      .populate('attendees', 'name');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Remove event from creator's eventsCreated array
    await User.findByIdAndUpdate(
      event.creator,
      { $pull: { eventsCreated: event._id } }
    );

    // Remove event from all attendees' eventsAttending arrays
    await User.updateMany(
      { eventsAttending: event._id },
      { $pull: { eventsAttending: event._id } }
    );

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { name, description, date, location, capacity, category, imageUrl } = req.body;

  try {
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    let updatedImageUrl = event.imageUrl;
    if (imageUrl && imageUrl !== event.imageUrl) {
      const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
        folder: "events",
      });
      updatedImageUrl = uploadResponse.secure_url;
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      {
        name,
        description,
        date,
        location,
        capacity,
        category,
        imageUrl: updatedImageUrl,
      },
      { new: true }
    ).populate('creator', 'name')
      .populate('attendees', 'name');

    // Emit to all clients viewing this event
    io.to(`event:${id}`).emit('eventUpdate', updatedEvent);

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const joinEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const userId = req.user._id;

    // Check if user exists
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if already attending
    if (event.attendees.includes(userId)) {
      return res.status(400).json({ message: 'Already joined this event' });
    }

    // Check capacity
    if (event.attendees.length >= event.capacity) {
      return res.status(400).json({ message: 'Event is at full capacity' });
    }

    // Add user to attendees
    event.attendees.push(userId);
    await event.save();

    // Add event to user's attending events
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { eventsAttending: event._id } }
    );

    // Get updated event with populated data
    const updatedEvent = await Event.findById(event._id)
      .populate('creator', 'name email')
      .populate('attendees', 'name email');

    // Emit socket events
    io.to(`event:${event._id}`).emit('eventUpdate', updatedEvent);
    io.to(`event:${event._id}`).emit('userJoined', {
      eventId: event._id,
      user: {
        _id: req.user._id,
        name: req.user.name
      },
      timestamp: new Date()
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const leaveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

     // Check if user is actually in the event
     if (!event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'Not attending this event' });
    }

    // Update Event model
    event.attendees = event.attendees.filter(
      attendee => attendee.toString() !== req.user._id.toString()
    );
    await event.save();

    // Update User model
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { eventsAttending: event._id } }
    );
     // Get updated event with populated data
     const updatedEvent = await Event.findById(event._id)
     .populate('creator', 'name')
     .populate('attendees', 'name');

   // Emit socket events
   io.to(`event:${event._id}`).emit('eventUpdate', updatedEvent);
   io.to(`event:${event._id}`).emit('userLeft', {
     eventId: event._id,
     user: req.user
   });

   res.json(updatedEvent);
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const handleJoinEvent = async () => {
  if (!authUser) {
    toast.error('Please login to join events');
    navigate('/login');
    return;
  }

  if (authUser.isGuest) {
    toast.error('Guest accounts cannot join events. Please create a full account.');
    return;
  }

  if (isEventFull) {
    toast.error('Event is at full capacity');
    return;
  }

  try {
    await dispatch(joinEvent(id)).unwrap();
    // Success toast is handled in the action
  } catch (error) {
    // Error toast is handled in the action
    console.error('Error joining event:', error);
  }
};