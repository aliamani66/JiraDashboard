import React from 'react';
import { motion } from 'framer-motion';
import ProjectCard from './ProjectCard';
import './ProjectGrid.css';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0 }
};

const ProjectGrid = ({ projects }) => {
  return (
    <motion.div 
      className="project-grid"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {projects.map((project) => (
        <motion.div key={project.id} variants={item}>
          <ProjectCard project={project} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default ProjectGrid;
