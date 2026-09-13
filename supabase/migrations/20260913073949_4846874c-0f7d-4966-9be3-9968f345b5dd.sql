-- ===== SKILLS =====
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skills TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT SELECT ON public.skills TO anon;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills readable" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "skills public read" ON public.skills FOR SELECT TO anon USING (true);
CREATE POLICY "skills managed by staff" ON public.skills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'));

-- ===== USER SKILLS =====
CREATE TABLE IF NOT EXISTS public.user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON public.user_skills(skill_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills read" ON public.user_skills FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));
CREATE POLICY "own skills write" ON public.user_skills FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own skills update" ON public.user_skills FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_user_skills_updated BEFORE UPDATE ON public.user_skills
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== COURSE SKILLS =====
CREATE TABLE IF NOT EXISTS public.course_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  importance text NOT NULL DEFAULT 'medium' CHECK (importance IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_course_skills_course ON public.course_skills(course_id);
CREATE INDEX IF NOT EXISTS idx_course_skills_skill ON public.course_skills(skill_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_skills TO authenticated;
GRANT SELECT ON public.course_skills TO anon;
GRANT ALL ON public.course_skills TO service_role;
ALTER TABLE public.course_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course skills read" ON public.course_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "course skills public read" ON public.course_skills FOR SELECT TO anon USING (true);
CREATE POLICY "course skills managed" ON public.course_skills FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_skills.course_id
      AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_skills.course_id
      AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ===== SKILL ASSESSMENT =====
CREATE TABLE IF NOT EXISTS public.skill_assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option integer NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saq_skill ON public.skill_assessment_questions(skill_id);
-- answer keys: server-side only, no authenticated/anon grants
GRANT ALL ON public.skill_assessment_questions TO service_role;
ALTER TABLE public.skill_assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.skill_assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saa_user ON public.skill_assessment_attempts(user_id);
GRANT SELECT ON public.skill_assessment_attempts TO authenticated;
GRANT ALL ON public.skill_assessment_attempts TO service_role;
ALTER TABLE public.skill_assessment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts read" ON public.skill_assessment_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'));

CREATE TABLE IF NOT EXISTS public.skill_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.skill_assessment_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.skill_assessment_questions(id) ON DELETE CASCADE,
  selected_option integer,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saans_attempt ON public.skill_assessment_answers(attempt_id);
GRANT SELECT ON public.skill_assessment_answers TO authenticated;
GRANT ALL ON public.skill_assessment_answers TO service_role;
ALTER TABLE public.skill_assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own answers read" ON public.skill_assessment_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.skill_assessment_attempts a
    WHERE a.id = skill_assessment_answers.attempt_id
      AND (a.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ===== ROADMAP =====
CREATE TABLE IF NOT EXISTS public.learning_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON public.learning_roadmaps(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_roadmaps TO authenticated;
GRANT ALL ON public.learning_roadmaps TO service_role;
ALTER TABLE public.learning_roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roadmap" ON public.learning_roadmaps FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_roadmaps_updated BEFORE UPDATE ON public.learning_roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.learning_roadmaps(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'recommended' CHECK (status IN ('locked','recommended','in_progress','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_roadmap ON public.roadmap_items(roadmap_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_items TO authenticated;
GRANT ALL ON public.roadmap_items TO service_role;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roadmap items" ON public.roadmap_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_roadmaps r WHERE r.id = roadmap_items.roadmap_id
     AND (r.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.learning_roadmaps r WHERE r.id = roadmap_items.roadmap_id AND r.user_id = auth.uid()));

-- ===== RAG CONTENT CHUNKS (lexical retrieval over real lesson text) =====
CREATE TABLE IF NOT EXISTS public.content_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON public.content_chunks USING gin(tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_lesson ON public.content_chunks(lesson_id);
GRANT SELECT ON public.content_chunks TO authenticated;
GRANT ALL ON public.content_chunks TO service_role;
ALTER TABLE public.content_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunks readable" ON public.content_chunks FOR SELECT TO authenticated USING (true);

-- link existing course quiz questions to skills (optional)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL;

-- ===== SEED SKILLS =====
INSERT INTO public.skills (name, category, description) VALUES
  ('Climate Dynamics','Climate Science','Drivers of climate variability, monsoon systems and long-term change.'),
  ('Atmospheric Pressure','Atmospheric Science','Pressure systems, gradients and their role in weather.'),
  ('Weather Systems','Atmospheric Science','Cyclones, fronts, convection and synoptic analysis.'),
  ('Numerical Modelling','Atmospheric Science','Model physics, ensembles and forecast verification.'),
  ('Ocean Observation','Oceanography','Buoys, floats, moorings and ocean sensing networks.'),
  ('Data Quality Control','Data Analysis','Validating, flagging and correcting observational data.'),
  ('Seismic Wave Analysis','Seismology','Waveform interpretation, phase picking and earthquake location.'),
  ('Satellite Image Processing','Remote Sensing','Radiometric and geometric processing of satellite imagery.'),
  ('Geospatial Analysis','Remote Sensing','Spatial data handling, projections and GIS analysis.'),
  ('Scientific Python','Digital Skills','Python for scientific data handling and visualisation.'),
  ('Machine Learning','Digital Skills','Applying ML models to earth-system datasets.'),
  ('Risk Communication','Scientific Communication','Communicating hazards and advisories to the public.'),
  ('Polar Processes','Polar Science','Cryosphere dynamics and polar observation programmes.')
ON CONFLICT (name) DO NOTHING;

-- ===== MAP SKILLS TO EXISTING PROGRAMMES =====
INSERT INTO public.course_skills (course_id, skill_id, importance)
SELECT c.id, s.id, m.importance
FROM (VALUES
  ('ocean-observation-systems','Ocean Observation','high'),
  ('ocean-observation-systems','Data Quality Control','high'),
  ('ocean-observation-systems','Polar Processes','low'),
  ('numerical-weather-prediction','Numerical Modelling','high'),
  ('numerical-weather-prediction','Atmospheric Pressure','high'),
  ('numerical-weather-prediction','Weather Systems','high'),
  ('numerical-weather-prediction','Climate Dynamics','medium'),
  ('seismology-early-warning','Seismic Wave Analysis','high'),
  ('seismology-early-warning','Risk Communication','medium'),
  ('satellite-remote-sensing','Satellite Image Processing','high'),
  ('satellite-remote-sensing','Geospatial Analysis','high'),
  ('satellite-remote-sensing','Climate Dynamics','low'),
  ('disaster-risk-management','Risk Communication','high'),
  ('disaster-risk-management','Weather Systems','medium'),
  ('data-science-ai-earth','Scientific Python','high'),
  ('data-science-ai-earth','Machine Learning','high'),
  ('data-science-ai-earth','Data Quality Control','medium')
) AS m(slug, skill, importance)
JOIN public.courses c ON c.slug = m.slug
JOIN public.skills s ON s.name = m.skill
ON CONFLICT (course_id, skill_id) DO NOTHING;

-- ===== SEED SKILL ASSESSMENT QUESTION BANK =====
INSERT INTO public.skill_assessment_questions (skill_id, question, options, correct_option, explanation, difficulty)
SELECT s.id, q.question, q.options::jsonb, q.correct, q.explanation, q.difficulty
FROM (VALUES
  ('Atmospheric Pressure','Standard sea-level atmospheric pressure is approximately:','["1013 hPa","850 hPa","500 hPa","1200 hPa"]',0,'Standard sea-level pressure is 1013.25 hPa.','easy'),
  ('Atmospheric Pressure','A steep horizontal pressure gradient usually produces:','["Stronger winds","Calm conditions","Higher humidity","Clear skies only"]',0,'Wind speed scales with the pressure gradient force.','medium'),
  ('Weather Systems','In the Northern Hemisphere, winds around a low-pressure system circulate:','["Anticlockwise","Clockwise","Radially outward","Vertically only"]',0,'Coriolis deflection makes cyclonic flow anticlockwise in the north.','medium'),
  ('Weather Systems','A tropical cyclone primarily draws its energy from:','["Latent heat from warm ocean water","Solar radiation on land","Jet stream shear","Volcanic aerosols"]',0,'Warm sea surface supplies latent heat that fuels the storm.','medium'),
  ('Climate Dynamics','The Indian summer monsoon is chiefly driven by:','["Differential land-sea heating","Lunar tides","Polar vortex collapse","Ocean salinity alone"]',0,'Seasonal land-sea thermal contrast reverses the circulation.','easy'),
  ('Climate Dynamics','El Nino conditions typically involve:','["Warming of the central-eastern equatorial Pacific","Cooling of the Atlantic only","Stronger Indian monsoon always","No SST change"]',0,'El Nino is defined by anomalous warming in the equatorial Pacific.','medium'),
  ('Numerical Modelling','Ensemble forecasting is mainly used to estimate:','["Forecast uncertainty","Sensor drift","Land use change","Seismic risk"]',0,'Ensembles sample initial-condition and model uncertainty.','medium'),
  ('Numerical Modelling','Parameterisation in NWP refers to:','["Representing sub-grid processes statistically","Increasing grid spacing","Deleting observations","Manual forecasting"]',0,'Processes smaller than the grid are represented by parameterisations.','hard'),
  ('Ocean Observation','Argo floats primarily measure:','["Temperature and salinity profiles","Seismic waves","Atmospheric ozone","Soil moisture"]',0,'Argo floats profile temperature and salinity of the upper ocean.','easy'),
  ('Ocean Observation','A moored data buoy in the Indian Ocean is typically used for:','["Continuous in-situ met-ocean observations","One-time bathymetry survey","Satellite launch support","Seismic drilling"]',0,'Moored buoys provide continuous time-series observations.','medium'),
  ('Data Quality Control','A spike in a sensor time series should first be:','["Flagged and reviewed against neighbouring data","Deleted silently","Published as is","Averaged into the mean"]',0,'QC flags preserve traceability before any correction.','medium'),
  ('Data Quality Control','Range checks in QC are used to:','["Reject physically impossible values","Improve resolution","Compress files","Encrypt data"]',0,'Range checks catch values outside physically plausible limits.','easy'),
  ('Seismic Wave Analysis','Which seismic wave arrives first at a station?','["P wave","S wave","Love wave","Rayleigh wave"]',0,'P (primary) waves are the fastest body waves.','easy'),
  ('Seismic Wave Analysis','Earthquake epicentre location typically requires arrivals from at least:','["Three stations","One station","Two stations","Ten stations"]',0,'Triangulation needs a minimum of three stations.','medium'),
  ('Satellite Image Processing','Radiometric correction of satellite imagery addresses:','["Sensor and atmospheric effects on measured radiance","Map projection errors","File naming","Orbit scheduling"]',0,'Radiometric correction converts raw counts to physical radiance.','medium'),
  ('Satellite Image Processing','NDVI is computed from:','["Near-infrared and red bands","Thermal and blue bands","Radar phase only","Panchromatic band only"]',0,'NDVI = (NIR - Red) / (NIR + Red).','easy'),
  ('Geospatial Analysis','A coordinate reference system defines:','["How locations map to the earth surface","Image contrast","File compression","Sensor gain"]',0,'A CRS ties coordinates to a datum and projection.','easy'),
  ('Geospatial Analysis','Raster resampling is needed when:','["Datasets have different resolutions or projections","Data is already aligned","Only metadata changes","Files are compressed"]',0,'Resampling aligns grids before analysis.','medium'),
  ('Scientific Python','Which library is standard for labelled multi-dimensional earth-science arrays?','["xarray","requests","flask","pillow"]',0,'xarray handles NetCDF-style labelled arrays.','medium'),
  ('Scientific Python','NumPy arrays are preferred over Python lists mainly because they are:','["Vectorised and memory efficient","Easier to print","Always sorted","Immutable"]',0,'Vectorised operations are far faster on large arrays.','easy'),
  ('Machine Learning','Overfitting means the model:','["Fits training data but generalises poorly","Is too simple","Has no parameters","Cannot be trained"]',0,'Overfit models memorise noise in the training set.','easy'),
  ('Machine Learning','For a rainfall regression task a suitable metric is:','["RMSE","Accuracy","F1 score","Precision"]',0,'RMSE is a standard regression error metric.','medium'),
  ('Risk Communication','An effective public cyclone advisory should lead with:','["The impact and required action","Technical model details","Raw data tables","Internal SOP codes"]',0,'Impact-based messaging drives protective action.','easy'),
  ('Risk Communication','Communicating forecast uncertainty publicly should:','["Be expressed in plain, actionable terms","Be omitted entirely","Use only probabilities without context","Be delayed"]',0,'Uncertainty must be understandable and actionable.','medium'),
  ('Polar Processes','Sea-ice extent in polar regions primarily affects climate through:','["Albedo feedback","Seismic activity","Soil erosion","Urban heat"]',0,'Bright ice reflects solar radiation; melting amplifies warming.','medium')
) AS q(skill, question, options, correct, explanation, difficulty)
JOIN public.skills s ON s.name = q.skill
WHERE NOT EXISTS (SELECT 1 FROM public.skill_assessment_questions x WHERE x.question = q.question);

-- ===== INDEX EXISTING LESSON CONTENT FOR THE TUTOR =====
INSERT INTO public.content_chunks (lesson_id, course_id, content, metadata)
SELECT l.id, m.course_id,
       l.title || E'\n' || l.content,
       jsonb_build_object('lesson_title', l.title, 'module_title', m.title, 'course_title', c.title)
FROM public.lessons l
JOIN public.modules m ON m.id = l.module_id
JOIN public.courses c ON c.id = m.course_id
WHERE length(coalesce(l.content,'')) > 0
  AND NOT EXISTS (SELECT 1 FROM public.content_chunks cc WHERE cc.lesson_id = l.id);

-- server-side retrieval helper
CREATE OR REPLACE FUNCTION public.search_content_chunks(_query text, _limit integer DEFAULT 5)
RETURNS TABLE (lesson_id uuid, course_id uuid, content text, metadata jsonb, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT cc.lesson_id, cc.course_id, cc.content, cc.metadata,
         ts_rank(cc.tsv, websearch_to_tsquery('english', _query)) AS rank
  FROM public.content_chunks cc
  WHERE cc.tsv @@ websearch_to_tsquery('english', _query)
  ORDER BY rank DESC
  LIMIT greatest(1, least(_limit, 10));
$$;
REVOKE EXECUTE ON FUNCTION public.search_content_chunks(text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_content_chunks(text, integer) TO authenticated, service_role;