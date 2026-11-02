ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS experience TEXT;

-- Update TonyStark's record so the AI actually has something to work with
UPDATE public.clients 
SET 
  skills = '{"Node.js", "NestJS", "Next.js", "Python", "SolidWorks", "Blender", "Unity", "PostgreSQL", "Linux", "TypeScript"}',
  experience = 'Full Stack Developer at Cyberpurview. Game & Engine Developer at Independent Studio. Experienced in Mechanical Engineering and Cinematic sound design.'
WHERE id = '75fa34fa-f250-4c8a-b405-03873f46bd8d';