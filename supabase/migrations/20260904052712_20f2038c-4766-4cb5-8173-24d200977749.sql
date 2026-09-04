
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','trainer','trainee');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  department text,
  designation text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self signup role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role <> 'admin');
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- COURSES
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  level text NOT NULL DEFAULT 'Beginner',
  cover_url text,
  duration_hours numeric NOT NULL DEFAULT 4,
  competencies text[] NOT NULL DEFAULT '{}',
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_courses_category ON public.courses(category);
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "published courses public" ON public.courses FOR SELECT TO anon USING (is_published);
CREATE POLICY "courses visible" ON public.courses FOR SELECT TO authenticated
  USING (is_published OR trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "trainers create courses" ON public.courses FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'trainer') AND trainer_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owners update courses" ON public.courses FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owners delete courses" ON public.courses FOR DELETE TO authenticated
  USING (trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_modules_course ON public.modules(course_id);
CREATE POLICY "modules public read" ON public.modules FOR SELECT TO anon USING (true);
CREATE POLICY "modules read" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules manage" ON public.modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  video_url text,
  resource_url text,
  duration_min int NOT NULL DEFAULT 15,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lessons_module ON public.lessons(module_id);
CREATE POLICY "lessons public read" ON public.lessons FOR SELECT TO anon USING (true);
CREATE POLICY "lessons read" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons manage" ON public.lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
        WHERE m.id = module_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
        WHERE m.id = module_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollment read" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.trainer_id = auth.uid()));
CREATE POLICY "enroll self" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own enrollment" ON public.enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own enrollment" ON public.enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress read" ON public.lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.trainer_id = auth.uid()));
CREATE POLICY "progress write" ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress delete" ON public.lesson_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  duration_min int NOT NULL DEFAULT 15,
  pass_score int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessments public read" ON public.assessments FOR SELECT TO anon USING (true);
CREATE POLICY "assessments read" ON public.assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assessments manage" ON public.assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  explanation text,
  position int NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions read" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions manage" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
        WHERE a.id = assessment_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
        WHERE a.id = assessment_id AND (c.trainer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attempts read" ON public.attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id AND c.trainer_id = auth.uid()));
CREATE POLICY "attempts insert" ON public.attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- CERTIFICATES
CREATE SEQUENCE public.certificate_seq START 1001;
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_no text NOT NULL UNIQUE DEFAULT ('MoES-CC-' || to_char(now(),'YYYY') || '-' || nextval('public.certificate_seq')),
  score int NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT USAGE ON SEQUENCE public.certificate_seq TO authenticated, anon, service_role;
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates verify public" ON public.certificates FOR SELECT TO anon USING (true);
CREATE POLICY "certificates read" ON public.certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "certificates insert own" ON public.certificates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());

-- SEED CONTENT
INSERT INTO public.courses (id, title, slug, summary, description, category, level, duration_hours, competencies) VALUES
('11111111-1111-1111-1111-111111111101','Ocean Observation Systems & Data Buoys','ocean-observation-systems','Design, deploy and maintain moored and drifting ocean observation platforms.','This course covers the full lifecycle of ocean observation systems operated under MoES, including moored buoys, Argo floats, tide gauges and telemetry pipelines. Learners study sensor calibration, quality control, data assimilation and field maintenance protocols.','Oceanography','Intermediate',12,'{Sensor Calibration,Data QC,Field Operations}'),
('11111111-1111-1111-1111-111111111102','Numerical Weather Prediction Fundamentals','numerical-weather-prediction','Understand NWP models, grids, parameterisation and forecast verification.','A practical introduction to numerical weather prediction as practised at national forecasting centres: governing equations, discretisation, physical parameterisation schemes, ensemble prediction and objective verification of forecasts.','Atmospheric Science','Advanced',18,'{Model Physics,Ensemble Forecasting,Verification}'),
('11111111-1111-1111-1111-111111111103','Seismology & Earthquake Early Warning','seismology-early-warning','Interpret seismic waveforms and operate early-warning workflows.','From seismometer installation to real-time magnitude estimation, this course builds the competencies needed to run a national seismological network and issue timely public advisories.','Geoscience','Intermediate',10,'{Waveform Analysis,Network Operations,Hazard Communication}'),
('11111111-1111-1111-1111-111111111104','Satellite Remote Sensing for Earth Systems','satellite-remote-sensing','Process and interpret satellite imagery for land, ocean and atmosphere.','Learn radiometric and geometric correction, spectral indices, retrieval algorithms and cloud-based processing of INSAT, Oceansat and Sentinel data for operational earth-system monitoring.','Remote Sensing','Beginner',8,'{Image Processing,Retrieval Algorithms,Geospatial Analysis}'),
('11111111-1111-1111-1111-111111111105','Disaster Risk Management & Public Advisories','disaster-risk-management','Turn scientific forecasts into actionable public warnings.','Covers the impact-based forecasting framework, standard operating procedures for cyclone and tsunami advisories, inter-agency coordination and risk communication with vulnerable communities.','Policy & Governance','Beginner',6,'{Risk Communication,SOP Compliance,Coordination}'),
('11111111-1111-1111-1111-111111111106','Data Science & AI for Earth Sciences','data-science-ai-earth','Apply machine learning to earth-science datasets at scale.','Hands-on curriculum on Python data pipelines, time-series modelling, deep learning for nowcasting, and responsible deployment of AI models within government scientific institutions.','Digital Skills','Advanced',20,'{Python,Machine Learning,MLOps}');

INSERT INTO public.modules (id, course_id, title, position) VALUES
('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111101','Foundations of Ocean Observation',1),
('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111101','Field Deployment & Maintenance',2),
('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111102','Model Formulation',1),
('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111102','Forecast Verification',2),
('22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111103','Seismic Instrumentation',1),
('22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111104','Sensors & Platforms',1),
('22222222-2222-2222-2222-222222222207','11111111-1111-1111-1111-111111111105','Warning Frameworks',1),
('22222222-2222-2222-2222-222222222208','11111111-1111-1111-1111-111111111106','Data Pipelines',1),
('22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111106','Modelling & Deployment',2);

INSERT INTO public.lessons (module_id, title, content, duration_min, position) VALUES
('22222222-2222-2222-2222-222222222201','Why we observe the ocean','The ocean stores over 90% of excess heat in the climate system. This lesson frames the scientific and societal case for sustained ocean observation.',18,1),
('22222222-2222-2222-2222-222222222201','Moored buoy architecture','Anatomy of a moored data buoy: hull, mooring line, sensor payload, power system and satellite telemetry.',25,2),
('22222222-2222-2222-2222-222222222201','Sensor calibration basics','Pre-deployment calibration, drift characterisation and traceability to reference standards.',22,3),
('22222222-2222-2222-2222-222222222202','Deployment planning','Vessel scheduling, site selection, permits and safety briefings for open-ocean deployment.',20,1),
('22222222-2222-2222-2222-222222222202','Preventive maintenance','Biofouling mitigation, battery replacement cycles and remote diagnostics.',24,2),
('22222222-2222-2222-2222-222222222203','Governing equations','Primitive equations, hydrostatic approximation and the numerics behind operational models.',30,1),
('22222222-2222-2222-2222-222222222203','Parameterisation schemes','Convection, radiation, boundary layer and microphysics schemes and their trade-offs.',28,2),
('22222222-2222-2222-2222-222222222204','Skill scores','RMSE, bias, ETS, Brier score and the correct use of each for operational verification.',26,1),
('22222222-2222-2222-2222-222222222205','Seismometers and networks','Broadband versus strong-motion sensors, siting criteria and telemetry design.',22,1),
('22222222-2222-2222-2222-222222222205','Rapid magnitude estimation','P-wave picking, magnitude proxies and the seconds that matter in early warning.',24,2),
('22222222-2222-2222-2222-222222222206','Orbits and sensors','Polar versus geostationary platforms and the spectral bands used in earth observation.',20,1),
('22222222-2222-2222-2222-222222222206','Atmospheric correction','Converting top-of-atmosphere radiance to surface reflectance.',22,2),
('22222222-2222-2222-2222-222222222207','Impact-based forecasting','Moving from hazard forecasts to impact and risk statements.',18,1),
('22222222-2222-2222-2222-222222222207','Advisory SOPs','Standard operating procedures for cyclone, tsunami and heatwave advisories.',20,2),
('22222222-2222-2222-2222-222222222208','Python for earth data','xarray, pandas and netCDF workflows for multidimensional scientific datasets.',30,1),
('22222222-2222-2222-2222-222222222208','Building reproducible pipelines','Versioning data, environments and results for scientific reproducibility.',26,2),
('22222222-2222-2222-2222-222222222209','Deep learning for nowcasting','Convolutional and recurrent architectures applied to radar nowcasting.',34,1),
('22222222-2222-2222-2222-222222222209','Responsible AI deployment','Model monitoring, drift detection and governance in public institutions.',24,2);

INSERT INTO public.assessments (id, course_id, title, duration_min, pass_score) VALUES
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','Ocean Observation Certification Exam',15,60),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111102','NWP Competency Assessment',20,60),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111103','Seismology Assessment',15,60),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111104','Remote Sensing Assessment',15,60),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111105','Disaster Management Assessment',10,60),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111106','AI for Earth Sciences Assessment',20,60);

INSERT INTO public.questions (assessment_id, prompt, options, correct_index, explanation, position) VALUES
('33333333-3333-3333-3333-333333333301','Approximately what share of excess heat in the climate system is stored by the ocean?','["About 30%","About 50%","About 90%","About 10%"]',2,'The ocean absorbs roughly 90% of the excess heat trapped by greenhouse gases.',1),
('33333333-3333-3333-3333-333333333301','Which issue most commonly degrades moored buoy sensors over time?','["Biofouling","Solar flares","Magnetic drift","Cosmic rays"]',0,'Marine growth on sensors is the dominant degradation mechanism.',2),
('33333333-3333-3333-3333-333333333301','Argo floats primarily measure which properties?','["Wind speed and direction","Temperature and salinity profiles","Seismic waves","Soil moisture"]',1,'Argo floats profile temperature and salinity of the upper ocean.',3),
('33333333-3333-3333-3333-333333333302','The hydrostatic approximation is generally valid when:','["Horizontal scales are much larger than vertical scales","Vertical motion dominates","The model grid is under 1 km","Radiation is neglected"]',0,'It holds for large horizontal-to-vertical aspect ratios.',1),
('33333333-3333-3333-3333-333333333302','Ensemble prediction systems are mainly used to estimate:','["Model resolution","Forecast uncertainty","Observation cost","Sensor drift"]',1,'Ensembles sample initial-condition and model uncertainty.',2),
('33333333-3333-3333-3333-333333333302','Which score is designed for probabilistic forecasts?','["RMSE","Bias","Brier score","Correlation"]',2,'The Brier score evaluates probabilistic forecasts of binary events.',3),
('33333333-3333-3333-3333-333333333303','Which seismic wave arrives first at a station?','["S wave","P wave","Love wave","Rayleigh wave"]',1,'P waves are compressional and travel fastest.',1),
('33333333-3333-3333-3333-333333333303','Earthquake early warning works because:','["Radio signals travel faster than seismic waves","Earthquakes are predictable","S waves are slower than sound","Satellites detect quakes first"]',0,'Alerts outrun damaging shaking using fast telemetry.',2),
('33333333-3333-3333-3333-333333333304','Geostationary satellites are preferred for:','["High spatial resolution mapping","High temporal frequency monitoring","Polar ice mapping","Subsurface imaging"]',1,'They provide frequent imaging of a fixed disc of the earth.',1),
('33333333-3333-3333-3333-333333333304','NDVI is computed from which bands?','["Red and near-infrared","Blue and green","Thermal and microwave","Ultraviolet and red"]',0,'NDVI = (NIR - Red) / (NIR + Red).',2),
('33333333-3333-3333-3333-333333333305','Impact-based forecasting emphasises:','["What the weather will be","What the weather will do","Model resolution","Sensor accuracy"]',1,'It communicates consequences, not just hazard values.',1),
('33333333-3333-3333-3333-333333333305','A tsunami advisory should first be issued by:','["Social media volunteers","The designated national warning centre","Any district office","Private forecasters"]',1,'Authoritative warnings come from the mandated national centre.',2),
('33333333-3333-3333-3333-333333333306','Which Python library is best suited to labelled multidimensional arrays?','["xarray","requests","flask","pillow"]',0,'xarray is designed for netCDF-style labelled N-D data.',1),
('33333333-3333-3333-3333-333333333306','Model drift monitoring in production primarily detects:','["Slower hardware","Changing input data distributions","Code syntax errors","UI regressions"]',1,'Drift means the live data distribution has shifted from training data.',2),
('33333333-3333-3333-3333-333333333306','Radar nowcasting typically forecasts over horizons of:','["0-3 hours","3-7 days","2-4 weeks","1 season"]',0,'Nowcasting targets the next few hours.',3);
