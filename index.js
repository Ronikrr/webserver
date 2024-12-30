const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating a secret key
const multer = require("multer");
const fs = require("fs");
require('dotenv').config();


const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
    phoneNo: { type: String, match: /^[0-9]{10}$/ },
    username: { type: String, },
    profileImage: { type: String },
    status :{type:String,default:'pending'}
});



const User = mongoose.model('Users', UserSchema);

const path = require("path");
const secretKey = crypto.randomBytes(64).toString('hex');


console.log(secretKey)
const app = express();
const MONGO_URI = process.env.MONGO_URI;
// Connect to MongoDB
mongoose.connect('mongodb+srv://ronikgorasiya:aK4iWDp9RTGsKUs4@versal.tl3hi.mongodb.net/?retryWrites=true&w=majority&appName=versal')
    .then(() => {
        console.log('MongoDB connected successfully!');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });

// app.use('/api', teamRoutes);

app.use(cors());
app.use(bodyParser.json());
const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        console.log('Token decoded successfully:', decoded);
        req.user = decoded; // Attach the decoded user info
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired.' });
        }
        console.error('Token verification failed:', error);
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
};




//////////user profile image //////////////////////

app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message });
});
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads'); // Directory to store uploaded files
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name
    },
});
const upload = multer({ storage });

// app.use('/uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'server', 'uploads')));


app.post('/upload-profile', upload.single('profileImage'), async (req, res) => {
    console.log(req.file);
    console.log(req.body._id);
    console.log(req.file.path);

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const _id = req.body._id;
    const filePath = req.file.filename;

    try {
        // Use await and new mongoose.Types.ObjectId
        console.log('User ID:', _id);
        const updatedUser = await User.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(_id) }, // Find user by _id
            { profileImage: filePath },                 // Update the profileImage field
            { new: true }                               // Return the updated user
        );

        console.log('User:', _id);  // This should show null if no user is found
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Add the profile image URL to the user object
        await updatedUser.save();
        // Successfully uploaded the file
        res.json({ message: 'Profile image uploaded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching user' });
    }
});


app.get("/view-profile", authenticate, async (req, res) => {
    console.log("Query:", req.query);

    try {
        const userId = req.query.userid;
        console.log("Received userId:", userId);

        // Validate the userId parameter
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: "error", message: "Invalid or missing User ID" });
        }

        // Convert userId to ObjectId
        const objectId = new mongoose.Types.ObjectId(userId);

        // Fetch images for the given userId, and make sure profileImage is properly queried
        const images = await User.find({ _id: objectId }).select('profileImage url');  // Changed userId to _id

        console.log("Fetched images:", images);

        if (images.length === 0) {
            return res.status(404).json({ status: "error", message: "No images found for the provided User ID" });
        }

        res.send({ status: "ok", data: images });
    } catch (error) {
        console.error("Error:", error.message);  // Log error message for better clarity
        res.status(500).json({ status: "error", message: error.message });
    }
});
app.get("/view_all_users", async (req, res) => {
    try {
        // Fetch all users from the database and select specific fields if needed
        const users = await User.find().select('name email profileImage'); // Modify fields as per your schema

        // Check if users exist
        if (users.length === 0) {
            return res.status(404).json({ status: "error", message: "No users found" });
        }

        res.send({ status: "ok", data: users });
    } catch (error) {
        console.error("Error:", error.message); // Log the error
        res.status(500).json({ status: "error", message: "An error occurred while fetching users" });
    }
});





app.post('/users', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const user = new User({ name, email, password, status: 'pending' });
        console.log(user)
        const doc = await user.save();
        res.status(201).json({ message: "User  registered successfully", user: doc });
    } catch (error) {
        console.error("Error saving user:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: "Username or email already exists." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
})
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
app.patch('/users/:id', async (req, res) => {
    try {
        console.log('Request received:', req.body);
        const { id } = req.params;
        const { status } = req.body;

        if (!['Approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(id, { status }, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('Updated user:', user);
        res.json({ message: 'Status updated successfully', user });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
});


app.post('/api/approve_user', async (req, res) => {
    try {
        const { userId, status } = req.body; // status: 'approved' or 'rejected'

        // Validate input fields
        if (!userId || !status) {
            return res.status(400).json({ message: "User ID and status are required." });
        }

        // Update user status in the database
        const updatedUser = await User.updateOne({ _id: userId }, { status });

        if (updatedUser.nModified === 0) {
            return res.status(404).json({ message: "User not found or no changes made." });
        }

        res.status(200).json({ message: "User status updated successfully." });
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});







app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email' });
        }
        if (user.status !== 'Approved') return res.status(403).send({ message: `Approval is ${user.status}` });

        if (user.password !== password) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ id: user._id, email: user.email }, secretKey, { expiresIn: '1h' });

        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

app.get('/profile', authenticate, async (req, res) => {
    try {
        const { email, username, phoneNo, profileImage } = req.body;

        const updates = {};
        if (email) updates.email = email;
        if (username) updates.username = username;
        if (phoneNo) updates.phoneNo = phoneNo;
        if (profileImage) updates.profileImage = profileImage;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            password: updatedUser.password,
            email: updatedUser.email,
            phoneNo: updatedUser.phoneNo,
            profileImage: updatedUser.profileImage,
        };

        res.json({ message: "Profile updated successfully.", user: userResponse });
    } catch (error) {
        console.error("Error updating profile:", error);

        if (error.code === 11000) { // Handle unique constraint errors (email)
            return res.status(400).json({ message: "Email must be unique." });
        }

        res.status(500).json({ message: "Internal server error." });
    }
});





//////////////////////////////////////////////   view couts

app.put('/profile', authenticate, upload.single('profileImage'), async (req, res) => {
    console.log(req.body)
    console.log(req.file)
    try {
        const { email, username, phoneNo } = req.body;

        const updates = {};
        if (email) updates.email = email;
        if (username) updates.username = username;
        if (phoneNo) updates.phoneNo = phoneNo;

        // Check if profile image is uploaded, else set default image
        if (req.file) {
            updates.profileImage = req.file.filename;
        } else {
            updates.profileImage = '../assets/img/rb_859.png'
        }

        // Update the user's information in the database
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            {
                new: true, // Return the updated document
                runValidators: true, // Validate fields before updating
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            phoneNo: updatedUser.phoneNo,
            profileImage: updatedUser.profileImage,
        };

        res.json({ message: "Profile updated successfully.", user: userResponse });
    } catch (error) {
        console.error("Error updating profile:", error);

        if (error.code === 11000) { // Handle unique constraint errors
            return res.status(400).json({ message: "Email must be unique." });
        }

        res.status(500).json({ message: "Internal server error." });
    }
});

const viewCountSchema = new mongoose.Schema({
    count: {
        type: Number,
        default: 0
    }
});

const ViewCount = mongoose.model('ViewCount', viewCountSchema);

app.get('/view_count', async (req, res) => {
    const viewCount = await ViewCount.findOne();

    res.json(viewCount);
})
app.post('/increment_viewcount', async (req, res) => {
    let viewCount = await ViewCount.findOne();  // Use `let` instead of `const`
    if (viewCount) {
        viewCount.count += 1;
        await viewCount.save();
    } else {
        viewCount = new ViewCount({ count: 1 });  // This is fine now since `viewCount` is declared with `let`
        await viewCount.save();
    }
    res.json({ message: 'View count incremented' });
});



////////////////////////////////////////////////////////////////////  contact form //////////////////

const contactformSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    contactnumber: { type: String, match: /^[0-9]{10}$/, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true }
});

const ContactForm = mongoose.models.ContactForm || mongoose.model('ContactForm', contactformSchema);

app.post("/contactform", async (req, res) => {
    try {
        const { name, email, contactnumber, subject, message } = req.body
        if (!name || !email || !contactnumber || !subject || !message) {
            return res.status(400).json({ message: "All fields are required" })
        }

        const contact = new ContactForm({ name, email, contactnumber, subject, message })
        console.log(contact)
        const doc = await contact.save();
        res.status(201).json({ message: "ok", data: doc });
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({ message: "Internal server error" });
    }

})
app.get('/view_contactform', async (req, res) => {
    const view_contactform = await ContactForm.findOne();

    res.json(view_contactform);
})

////////////////////////////////////////////////////////////////// teampageSchema ///////////////////////////////////////////////////////////////////

const teampageSchema = new mongoose.Schema({
    name: { type: String },
    post: { type: String },
    image: { type: String }, // Store the image file path
    linkedin: { type: String },
    insta: { type: String },
    facebook: { type: String },
});

const teampage = mongoose.model('Teampage', teampageSchema);
app.use(bodyParser.json());

app.use(cors({
    origin: 'http://127.0.0.1:3000', // For development, use * or specify frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'get', 'post', 'put', 'delete'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
}));
// CREATE: Add a new team member with an image
app.post('/api/teampage', upload.single('image'), async (req, res) => {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file.image);
    try {
        const { name, post, linkedin, insta, facebook } = req.body;
        const imagePath = req.file.name;

        const newMember = new teampage({ name, post, linkedin, insta, facebook, image: imagePath });
        const savedMember = await newMember.save();
        res.status(200).json({ message: 'Team member created successfully', member: savedMember });
    } catch (error) {
        console.error('Error creating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// READ: Get all team members (with image URLs)
app.get('/api/teampage', async (req, res) => {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.image);
    try {
        const members = await teampage.find();
        console.log("Fetched team members:", members);
        res.status(200).json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// READ: Get a single team member by ID
app.get('/api/teampage/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const member = await teampage.findById(id);
        if (!member) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        res.status(200).json(member);
    } catch (error) {
        console.error('Error fetching team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// UPDATE: Update a team member's details, including the image
app.put('/api/teampage/:id', upload.single('image'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedMember = await teampage.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        res.status(200).json({ message: 'Team member updated successfully', member: updatedMember });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// DELETE: Remove a team member
app.delete('/api/teampage/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedMember = await teampage.findByIdAndDelete(id);
        if (!deletedMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // Delete the image file if it exists
        if (deletedMember.image && fs.existsSync(deletedMember.image)) {
            fs.unlinkSync(deletedMember.image);
        }

        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


////////////////////////////////////////////////////////////////// valueclientSchema ///////////////////////////////////////////////////////////////////




const valueclientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String }, // Store the image file path
});

const valueclient = mongoose.model('Valueableclients', valueclientSchema);

app.post('/api/valuedclients', upload.single('images'), async (req, res) => {
    try {
        const { name } = req.body;

        // Ensure file exists
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const imagePath = req.file.filename; // Use the correct property for file path

        // Create a new client
        const client = new valueclient({ name, image: imagePath });
        const savedclient = await client.save();

        res.status(200).json({
            message: 'Client member created successfully',
            member: savedclient,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/valuedclients', async (req, res) => {
    try {
        const clients = await valueclient.find();
        console.log("Fetched team members:", clients);
        res.status(200).json(clients);
    } catch (error) {
        console.error('Error fetching team clients:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.put('/api/valuedclients/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedclients = await valueclient.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedclients) {
            return res.status(404).json({ message: 'Team clients not found' });
        }
        res.status(200).json({ message: 'Team clients updated successfully', member: updatedclients });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.delete('/api/valuedclients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedclients = await valueclient.findByIdAndDelete(id);
        if (!deletedclients) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // Delete the image file if it exists
        if (deletedclients.image && fs.existsSync(deletedclients.image)) {
            fs.unlinkSync(deletedclients.image);
        }
        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});




//////////////////////////////////////////////////////////////////////////// lastworkSchema ////////////////////////////////////////////////////////////////




const lastworkSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    business: { type: String, required: true },
    rate: { type: String, required: true },
    image: { type: String, required: true }, 
});

const lastwork = mongoose.model('LastworkSchema', lastworkSchema);
app.post('/api/lastworkadd', upload.single('image_work'), async (req, res) => {
    try {
        const { name, description, work } = req.body;

        // Ensure file exists
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const imagePath = req.file.filename; // Use the correct property for file path

        // Create a new client
        const lastworkadd = new lastwork({ name, description, work, image: imagePath });
        const savedlastworkadd = await lastworkadd.save();

        res.status(200).json({
            message: 'Client member created successfully',
            member: savedlastworkadd,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/lastworkadd', async (req, res) => {
    try {
        const lastworkadd = await lastwork.find();
        console.log("Fetched team members:", lastworkadd);
        res.status(200).json(lastworkadd);
    } catch (error) {
        console.error('Error fetching team clients:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.put('/api/lastworkadd/:id', upload.single('image_work'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedlastwork = await lastwork.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedlastwork) {
            return res.status(404).json({ message: 'Team clients not found' });
        }
        res.status(200).json({ message: 'Team clients updated successfully', member: updatedlastwork });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.delete('/api/lastworkadd/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedlastwork = await lastwork.findByIdAndDelete(id);
        if (!deletedlastwork) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // Delete the image file if it exists
        if (deletedlastwork.image && fs.existsSync(deletedlastwork.image)) {
            fs.unlinkSync(deletedlastwork.image);
        }
        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



//////////////////////////////////////////////////////////////////////////// lastworkSchema ////////////////////////////////////////////////////////////////
const projectSchema = new mongoose.Schema({
    totalClients: { type: String, required: true },
    completedProjects: { type: String, required: true },
});

const project = mongoose.model('Project', projectSchema);

app.post('/api/project', async (req, res) => {
    console.log('Received request body:', req.body);

    try {
        const { totalClients, completedProjects } = req.body;

        const projectadd = new project({ totalClients, completedProjects });
        const savedprojectaddadd = await projectadd.save();

        res.status(200).json({
            message: 'project created successfully',
            member: savedprojectaddadd,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/project', async (req, res) => {
    try {
        // Fetch all projects from the database
        const projects = await project.find();

        if (!projects || projects.length === 0) {
            return res.status(404).json({ message: 'No projects found' });
        }

        res.status(200).json({
            message: 'Projects retrieved successfully',
            projects
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


//////////////////////////////////////////// client rate///////////////!SECTION



const clientrateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    business: { type: String, required: true },
    rate: { type: String, required: true },
    image: { type: String }, // Store the image file path
});

const clientrate = mongoose.model('Clientrate', clientrateSchema);
app.post('/api/clientrate', upload.single('image_work'), async (req, res) => {
    try {
        const { name, description, business, rate } = req.body;

        // Ensure file exists
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const imagePath = req.file.filename; // Use the correct property for file path

        // Create a new client
        const clientrateadd = new clientrate({ name, description, business, rate, image: imagePath });
        const savedclientratekadd = await clientrateadd.save();

        res.status(200).json({
            message: 'Client member created successfully',
            member: savedclientratekadd,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/clientrate', async (req, res) => {
    try {
        const clientrateadd = await clientrate.find();
        console.log("Fetched team members:", clientrateadd);
        res.status(200).json(clientrateadd);
    } catch (error) {
        console.error('Error fetching team clients:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.put('/api/clientrate/:id', upload.single('image_client_work'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedclientrate = await clientrate.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedclientrate) {
            return res.status(404).json({ message: 'Team clients not found' });
        }
        res.status(200).json({ message: 'Team clients updated successfully', member: updatedclientrate });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.delete('/api/valuedclients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedclientrate = await lastwork.findByIdAndDelete(id);
        if (!deletedclientrate) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // Delete the image file if it exists
        if (deletedclientrate.image && fs.existsSync(deletedclientrate.image)) {
            fs.unlinkSync(deletedclientrate.image);
        }
        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



//////////////////////////////////////////// service page ////////////////////////////////////////////////////////////

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    title: { type: String, required: true },
    dis1: { type: String, required: true },
    dis2: { type: String, required: true },
    image: { type: String },
});

const service = mongoose.model('Servicepage', serviceSchema);


app.post('/api/service', upload.single('image_client_work'), async (req, res) => {
    try {
        const { name, title, dis1, dis2 } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }
        const imagePath = req.file.filename;
        const serviceadd = new service({ name, title, dis1, dis2, image: imagePath });
        const savedserviceadd = await serviceadd.save();

        res.status(200).json({
            message: 'Client member created successfully',
            member: savedserviceadd,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.get('/api/service', async (req, res) => {
    try {
        const serviceadd = await service.find();
        console.log("Fetched team members:", serviceadd);
        res.status(200).json(serviceadd);
    } catch (error) {
        console.error('Error fetching team clients:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.put('/api/service/:id', upload.single('image_client_work'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedservice = await service.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedservice) {
            return res.status(404).json({ message: 'Team clients not found' });
        }
        res.status(200).json({ message: 'Team clients updated successfully', member: updatedservice });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.delete('/api/service/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedservice = await service.findByIdAndDelete(id);
        if (!deletedservice) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        if (deletedservice.image && fs.existsSync(deletedservice.image)) {
            fs.unlinkSync(deletedservice.image);
        }
        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


/////////////////////////////////////////////////////// blog page //////////////////////////////////////////////////////


const blogSchema = new mongoose.Schema({
    name: { type: String, required: true },
    title1: { type: String, required: true },
    description1: { type: String, required: true },
    title2: { type: String, required: true },
    description2: { type: String, required: true },
    title3: { type: String, required: true },
    description3: { type: String, required: true },
    image: { type: String },
});

const blog = mongoose.model('Blogpage', blogSchema);


app.post('/api/blogpage', upload.single('image_client_work'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { name, title1, description1, title2, description2, title3, description3, } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }
        const imagePath = req.file.filename;
        const blogadd = new blog({ name, title1, description1, title2, description2, title3, description3, image: imagePath });
        const savedblogadd = await blogadd.save();

        res.status(200).json({
            message: 'Client member created successfully',
            member: savedblogadd,
        });
    } catch (error) {
        console.error('Error creating client member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.get('/api/blogpage', async (req, res) => {
    try {
        const serviceadd = await blog.find();
        console.log("Fetched team members:", serviceadd);
        res.status(200).json(serviceadd);
    } catch (error) {
        console.error('Error fetching team clients:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.put('/api/blogpage/:id', upload.single('image_client_work'), async (req, res) => {
    console.log(req.body)
    console.log(req.file.filename)
    try {
        const { id } = req.params;

        const updates = req.body;
        if (req.file) {
            updates.image = req.file.filename;
        }

        const updatedservice = await blog.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedservice) {
            return res.status(404).json({ message: 'Team clients not found' });
        }
        res.status(200).json({ message: 'Team clients updated successfully', member: updatedservice });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.delete('/api/blogpage/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedservice = await blog.findByIdAndDelete(id);
        if (!deletedservice) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        if (deletedservice.image && fs.existsSync(deletedservice.image)) {
            fs.unlinkSync(deletedservice.image);
        }
        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const PORT = process.env.PORT

app.listen(PORT, () => {
    console.log('Server connected on port 8000');
  
});
