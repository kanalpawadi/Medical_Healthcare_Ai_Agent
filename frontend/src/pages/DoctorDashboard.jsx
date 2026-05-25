import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, FileText, Search, User } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

function DoctorDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadQueue() {
      const response = await fetch(`${API_BASE}/patients`);
      const data = await response.json();
      if (!mounted) return;
      setPatients(data);
      setSelectedPatient((current) => current || data[0] || null);
      setLoading(false);
    }

    loadQueue().catch(() => setLoading(false));
    const interval = setInterval(loadQueue, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return patients.filter((patient) => (
      patient.name?.toLowerCase().includes(query)
      || patient.mobile?.includes(searchTerm)
      || patient.complaint?.toLowerCase().includes(query)
    ));
  }, [patients, searchTerm]);

  const report = selectedPatient?.medical_data?.report || {};
  const medicalData = selectedPatient?.medical_data || {};
  const transcriptLines = (selectedPatient?.raw_transcript || '')
    .split('\n')
    .filter(Boolean)
    .slice(-8);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
      <aside className="w-full md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-screen max-h-screen">
        <div className="p-6 border-b border-slate-800">
          <button
            onClick={() => navigate('/')}
            className="mb-6 p-2 hover:bg-slate-800 transition-colors flex items-center gap-2 text-slate-300 w-fit"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Exit</span>
          </button>
          <h2 className="text-2xl font-bold text-white mb-6">Today&apos;s Queue</h2>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by name, mobile, complaint"
              className="w-full bg-slate-800 border border-slate-700 py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-slate-500 p-4">Loading patient queue...</p>}
          {!loading && filteredPatients.length === 0 && (
            <p className="text-slate-500 p-4">No patient reports yet. Complete a kiosk session to populate this queue.</p>
          )}
          {filteredPatients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient)}
              className={`w-full text-left p-4 cursor-pointer transition-all border ${
                selectedPatient?.id === patient.id
                  ? 'bg-emerald-950 border-emerald-600'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-white">{patient.name || 'Unknown patient'}</h3>
                <span className="text-xs text-slate-500">{patient.time}</span>
              </div>
              <p className="text-sm text-slate-400 mb-3 truncate">{patient.complaint}</p>
              {patient.status === 'ready' ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-900 px-2 py-1 text-xs font-medium">
                  <CheckCircle size={14} /> Report Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-950 px-2 py-1 text-xs font-medium">
                  <Clock size={14} /> In Progress
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 bg-slate-950 h-screen overflow-y-auto">
        {selectedPatient ? (
          <div className="p-8 max-w-5xl mx-auto">
            <header className="mb-8 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 pb-6 border-b border-slate-800">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{selectedPatient.name || 'Unknown patient'}</h1>
                <div className="flex flex-wrap items-center gap-4 text-slate-400">
                  <span className="flex items-center gap-1">
                    <User size={16} /> {selectedPatient.age || 'Age not captured'} {selectedPatient.age ? 'yrs' : ''}
                  </span>
                  <span>{selectedPatient.gender || 'Gender not captured'}</span>
                  <span>{selectedPatient.mobile || 'Mobile not captured'}</span>
                  <span>{selectedPatient.language || medicalData.detected_language || 'Language pending'}</span>
                </div>
              </div>
              <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                Start Consultation
              </button>
            </header>

            {selectedPatient.status === 'ready' ? (
              <div className="space-y-8">
                <section>
                  <h2 className="text-lg font-semibold text-emerald-300 mb-4 flex items-center gap-2">
                    <FileText size={20} /> AI Medical Summary
                  </h2>
                  <div className="bg-slate-900 border border-slate-800 p-6">
                    <p className="text-slate-200 leading-relaxed">
                      {report.summary || selectedPatient.summary || 'Report summary was generated without additional narrative.'}
                    </p>
                  </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <section>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">Structured Intake</h2>
                    <div className="bg-slate-900 border border-slate-800 p-6 space-y-4 text-sm">
                      <Field label="Chief complaint" value={report.chief_complaint || medicalData.chief_complaint} />
                      <Field label="Symptoms" value={(report.symptoms || medicalData.symptoms || []).join(', ') || 'Not reported'} />
                      <Field label="Duration" value={report.duration || medicalData.duration} />
                      <Field label="Current medications" value={report.medications || medicalData.current_medications} />
                      <Field label="Allergies" value={report.allergies || medicalData.allergies} />
                      <Field label="Past history" value={report.past_history || medicalData.past_history} />
                      <Field label="Family history" value={report.family_history || medicalData.family_history} />
                    </div>
                  </section>

                  <section>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">Transcript Preview</h2>
                    <div className="bg-slate-900 border border-slate-800 p-6 space-y-3 text-sm max-h-96 overflow-y-auto">
                      {transcriptLines.length === 0 && <p className="text-slate-500">Transcript not available.</p>}
                      {transcriptLines.map((line, index) => {
                        const isPatient = line.startsWith('Patient:');
                        return (
                          <div
                            key={`${line}-${index}`}
                            className={`p-3 ${
                              isPatient
                                ? 'bg-emerald-950 text-emerald-100 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Clock size={48} className="mb-4 text-amber-400 animate-pulse" />
                <p className="text-lg">Waiting for patient to complete registration...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Select a patient from the queue to view their report.
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium text-right">{value || 'Not reported'}</span>
    </div>
  );
}

export default DoctorDashboard;
