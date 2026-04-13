import { useAuth } from "../hooks/useAuth";

export function HomePage() {
	const { user, signOut } = useAuth();

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
				<h1 className="text-lg font-bold text-slate-900">Borrower Portal</h1>
				<div className="flex items-center gap-4">
					<span className="text-sm text-slate-600">{user?.email}</span>
					<button
						onClick={signOut}
						className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
					>
						Sign out
					</button>
				</div>
			</header>
			<main className="max-w-4xl mx-auto p-8">
				<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome</h2>
					<p className="text-slate-600">
						Your loan application dashboard will appear here once SDK components are built.
					</p>
				</div>
			</main>
		</div>
	);
}
