/**
 * Nexrow — Seed 20 Dummy Freelancers into Firebase Firestore
 * 
 * Usage:  node seed-freelancers.js
 * 
 * Reads Firebase config from .env (VITE_FIREBASE_*) and writes
 * each freelancer as a document into the "freelancers" collection.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { config } from 'dotenv';

// Load .env
config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const freelancers = [
  {
    id: 'FL-001',
    name: 'Aarav Sharma',
    domain: 'Full Stack Web Development',
    experience: '5 Years',
    rating: 4.9,
    completedProjects: 128,
    hourlyRate: 1500,
    hourlyRateDisplay: '₹1,500/hr',
    location: 'Mumbai',
    availability: 'Available',
    bio: 'Builds scalable React, Node.js & MongoDB applications.',
    email: 'aarav.sharma@nexrow.io',
    joinedAt: '2024-03-15T10:00:00Z'
  },
  {
    id: 'FL-002',
    name: 'Priya Patel',
    domain: 'UI/UX Design',
    experience: '4 Years',
    rating: 4.8,
    completedProjects: 95,
    hourlyRate: 1200,
    hourlyRateDisplay: '₹1,200/hr',
    location: 'Ahmedabad',
    availability: 'Available',
    bio: 'Creates premium mobile and web interfaces using Figma.',
    email: 'priya.patel@nexrow.io',
    joinedAt: '2024-04-02T10:00:00Z'
  },
  {
    id: 'FL-003',
    name: 'Rohan Mehta',
    domain: 'Logo & Brand Identity',
    experience: '6 Years',
    rating: 5.0,
    completedProjects: 210,
    hourlyRate: 1000,
    hourlyRateDisplay: '₹1,000/hr',
    location: 'Pune',
    availability: 'Busy',
    bio: 'Expert in minimalist and luxury brand identity.',
    email: 'rohan.mehta@nexrow.io',
    joinedAt: '2024-01-10T10:00:00Z'
  },
  {
    id: 'FL-004',
    name: 'Sneha Kulkarni',
    domain: 'Sketch Artist',
    experience: '3 Years',
    rating: 4.7,
    completedProjects: 76,
    hourlyRate: 850,
    hourlyRateDisplay: '₹850/hr',
    location: 'Nagpur',
    availability: 'Available',
    bio: 'Hyper-realistic pencil portraits and custom sketches.',
    email: 'sneha.kulkarni@nexrow.io',
    joinedAt: '2024-06-20T10:00:00Z'
  },
  {
    id: 'FL-005',
    name: 'Aditya Verma',
    domain: 'WordPress Development',
    experience: '5 Years',
    rating: 4.8,
    completedProjects: 140,
    hourlyRate: 900,
    hourlyRateDisplay: '₹900/hr',
    location: 'Delhi',
    availability: 'Available',
    bio: 'Develops SEO-friendly business websites.',
    email: 'aditya.verma@nexrow.io',
    joinedAt: '2024-02-28T10:00:00Z'
  },
  {
    id: 'FL-006',
    name: 'Neha Singh',
    domain: 'Digital Painting',
    experience: '4 Years',
    rating: 4.9,
    completedProjects: 88,
    hourlyRate: 1100,
    hourlyRateDisplay: '₹1,100/hr',
    location: 'Jaipur',
    availability: 'Busy',
    bio: 'Creates fantasy, concept and portrait digital artwork.',
    email: 'neha.singh@nexrow.io',
    joinedAt: '2024-05-15T10:00:00Z'
  },
  {
    id: 'FL-007',
    name: 'Karan Joshi',
    domain: 'Mobile App Development',
    experience: '6 Years',
    rating: 4.9,
    completedProjects: 135,
    hourlyRate: 1700,
    hourlyRateDisplay: '₹1,700/hr',
    location: 'Bengaluru',
    availability: 'Available',
    bio: 'Flutter & React Native expert for Android/iOS apps.',
    email: 'karan.joshi@nexrow.io',
    joinedAt: '2024-01-05T10:00:00Z'
  },
  {
    id: 'FL-008',
    name: 'Isha Kapoor',
    domain: 'Graphic Design',
    experience: '4 Years',
    rating: 4.8,
    completedProjects: 160,
    hourlyRate: 950,
    hourlyRateDisplay: '₹950/hr',
    location: 'Chandigarh',
    availability: 'Available',
    bio: 'Social media creatives, brochures and banners.',
    email: 'isha.kapoor@nexrow.io',
    joinedAt: '2024-03-22T10:00:00Z'
  },
  {
    id: 'FL-009',
    name: 'Rahul Nair',
    domain: 'Backend Development',
    experience: '7 Years',
    rating: 4.9,
    completedProjects: 182,
    hourlyRate: 1600,
    hourlyRateDisplay: '₹1,600/hr',
    location: 'Kochi',
    availability: 'Busy',
    bio: 'Builds secure REST APIs using Node.js & Express.',
    email: 'rahul.nair@nexrow.io',
    joinedAt: '2023-11-18T10:00:00Z'
  },
  {
    id: 'FL-010',
    name: 'Meera Deshmukh',
    domain: 'Pot Design & Ceramic Art',
    experience: '5 Years',
    rating: 4.8,
    completedProjects: 92,
    hourlyRate: 700,
    hourlyRateDisplay: '₹700/hr',
    location: 'Kolhapur',
    availability: 'Available',
    bio: 'Handmade decorative and customized ceramic pots.',
    email: 'meera.deshmukh@nexrow.io',
    joinedAt: '2024-04-10T10:00:00Z'
  },
  {
    id: 'FL-011',
    name: 'Vikram Rao',
    domain: 'Frontend Development',
    experience: '5 Years',
    rating: 4.8,
    completedProjects: 155,
    hourlyRate: 1300,
    hourlyRateDisplay: '₹1,300/hr',
    location: 'Hyderabad',
    availability: 'Available',
    bio: 'React, Next.js and Tailwind CSS specialist.',
    email: 'vikram.rao@nexrow.io',
    joinedAt: '2024-02-14T10:00:00Z'
  },
  {
    id: 'FL-012',
    name: 'Ananya Roy',
    domain: 'Watercolor Painting',
    experience: '6 Years',
    rating: 5.0,
    completedProjects: 115,
    hourlyRate: 900,
    hourlyRateDisplay: '₹900/hr',
    location: 'Kolkata',
    availability: 'Busy',
    bio: 'Professional watercolor artist for portraits and landscapes.',
    email: 'ananya.roy@nexrow.io',
    joinedAt: '2024-01-22T10:00:00Z'
  },
  {
    id: 'FL-013',
    name: 'Soham Patil',
    domain: '3D Modeling & Rendering',
    experience: '4 Years',
    rating: 4.7,
    completedProjects: 74,
    hourlyRate: 1400,
    hourlyRateDisplay: '₹1,400/hr',
    location: 'Nashik',
    availability: 'Available',
    bio: 'Creates realistic 3D models for architecture and products.',
    email: 'soham.patil@nexrow.io',
    joinedAt: '2024-05-08T10:00:00Z'
  },
  {
    id: 'FL-014',
    name: 'Kavya Menon',
    domain: 'Content Writing',
    experience: '5 Years',
    rating: 4.8,
    completedProjects: 225,
    hourlyRate: 750,
    hourlyRateDisplay: '₹750/hr',
    location: 'Chennai',
    availability: 'Available',
    bio: 'SEO blogs, technical writing and website content.',
    email: 'kavya.menon@nexrow.io',
    joinedAt: '2024-03-30T10:00:00Z'
  },
  {
    id: 'FL-015',
    name: 'Arjun Gupta',
    domain: 'AI & Machine Learning',
    experience: '3 Years',
    rating: 4.9,
    completedProjects: 61,
    hourlyRate: 2000,
    hourlyRateDisplay: '₹2,000/hr',
    location: 'Noida',
    availability: 'Busy',
    bio: 'Develops AI chatbots and predictive ML models.',
    email: 'arjun.gupta@nexrow.io',
    joinedAt: '2024-06-01T10:00:00Z'
  },
  {
    id: 'FL-016',
    name: 'Riya Fernandes',
    domain: 'Illustration',
    experience: '5 Years',
    rating: 4.8,
    completedProjects: 109,
    hourlyRate: 1000,
    hourlyRateDisplay: '₹1,000/hr',
    location: 'Goa',
    availability: 'Available',
    bio: "Children's books, editorial and commercial illustrations.",
    email: 'riya.fernandes@nexrow.io',
    joinedAt: '2024-04-18T10:00:00Z'
  },
  {
    id: 'FL-017',
    name: 'Dev Malhotra',
    domain: 'Video Editing & Motion Graphics',
    experience: '6 Years',
    rating: 4.9,
    completedProjects: 175,
    hourlyRate: 1250,
    hourlyRateDisplay: '₹1,250/hr',
    location: 'Indore',
    availability: 'Available',
    bio: 'Adobe Premiere Pro & After Effects expert.',
    email: 'dev.malhotra@nexrow.io',
    joinedAt: '2024-02-05T10:00:00Z'
  },
  {
    id: 'FL-018',
    name: 'Pooja Chavan',
    domain: 'Handcrafted Wall Art',
    experience: '4 Years',
    rating: 4.7,
    completedProjects: 68,
    hourlyRate: 800,
    hourlyRateDisplay: '₹800/hr',
    location: 'Ratnagiri',
    availability: 'Available',
    bio: 'Creates handmade wall décor and canvas artwork.',
    email: 'pooja.chavan@nexrow.io',
    joinedAt: '2024-05-25T10:00:00Z'
  },
  {
    id: 'FL-019',
    name: 'Yash Thakur',
    domain: 'Cyber Security Consultant',
    experience: '5 Years',
    rating: 4.9,
    completedProjects: 84,
    hourlyRate: 1900,
    hourlyRateDisplay: '₹1,900/hr',
    location: 'Gurugram',
    availability: 'Busy',
    bio: 'Penetration testing, vulnerability assessment and audits.',
    email: 'yash.thakur@nexrow.io',
    joinedAt: '2024-01-28T10:00:00Z'
  },
  {
    id: 'FL-020',
    name: 'Zoya Khan',
    domain: 'Calligraphy & Custom Invitations',
    experience: '4 Years',
    rating: 4.8,
    completedProjects: 97,
    hourlyRate: 850,
    hourlyRateDisplay: '₹850/hr',
    location: 'Lucknow',
    availability: 'Available',
    bio: 'Elegant handwritten invitations and premium calligraphy.',
    email: 'zoya.khan@nexrow.io',
    joinedAt: '2024-03-12T10:00:00Z'
  }
];

async function seed() {
  console.log('🌱 Seeding 20 freelancers into Firestore...\n');

  for (const fl of freelancers) {
    const docId = fl.id; // e.g. "FL-001"
    try {
      await setDoc(doc(db, 'freelancers', docId), {
        name: fl.name,
        domain: fl.domain,
        experience: fl.experience,
        rating: fl.rating,
        completed_projects: fl.completedProjects,
        hourly_rate: fl.hourlyRate,
        hourly_rate_display: fl.hourlyRateDisplay,
        location: fl.location,
        availability: fl.availability,
        bio: fl.bio,
        email: fl.email,
        joined_at: fl.joinedAt,
        created_at: new Date().toISOString()
      });
      console.log(`  ✅ ${docId} — ${fl.name} (${fl.domain})`);
    } catch (err) {
      console.error(`  ❌ ${docId} — ${fl.name}: ${err.message}`);
    }
  }

  console.log('\n🎉 Seeding complete! 20 freelancers added to "freelancers" collection.');
  process.exit(0);
}

seed();
