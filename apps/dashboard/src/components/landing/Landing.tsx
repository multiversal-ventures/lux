import { Link } from "react-router-dom";
import { FileText, CheckCircle2, Shield, ArrowRight } from "lucide-react";
import feneroLogo from "../../assets/logo-orange.svg";
import heroBackground from "../../assets/landing-page/background-hero.png";
import soc2Badge from "../../assets/landing-page/soc2-badge.png";

import Shell from "./Shell";

function LandingPage() {
	const features = [
		{
			icon: <FileText className="w-8 h-8" />,
			title: "AI-Powered Reading",
			description:
				"AI reads and analyzes tax returns, W-2s, 1099s, and income documents to extract all relevant income data",
		},
		{
			icon: <CheckCircle2 className="w-8 h-8" />,
			title: "Intelligent Guidance",
			description:
				"Navigate complex income situations including self-employment, multiple income sources, and unique scenarios with AI assistance",
		},
		{
			icon: <Shield className="w-8 h-8" />,
			title: "Validation & Verification",
			description:
				"Automatic income calculations with multi-year analysis and verification of qualifying income",
		},
	];

	const benefits = [
		"No more manual review of multiple years of tax documents",
		"Save hours per application - focus on home buyers instead",
		"Handle complex self-employed and multi-income scenarios",
		"Reduce manual calculation errors and compliance risks",
		"AI-guided analysis of W-2s, 1099s, tax returns, and more",
		"Review only what AI produces - streamlined workflow",
	];

	return (
		<Shell showFooter={true} variant="landing">
			{/* Hero Section - Fenero Style */}
			<section
				className="relative min-h-[650px] lg:min-h-[600px] bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: `url(${heroBackground})` }}
			>
				{/* Gradient overlay for better text readability */}
				<div className="absolute inset-0 bg-gradient-to-r from-[#E2E8F0] from-40% via-[#E2E8F0]/95 via-60% to-[#E2E8F0]/30"></div>

				<div className="relative h-full flex items-center">
					<div className="max-w-7xl mx-auto px-4 py-16 lg:py-24 w-full">
						<div className="max-w-xl lg:max-w-[600px]">
							<div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur text-orange-600 px-4 py-2 rounded-full mb-6 font-medium">
								Income Verification with AI
							</div>

							<h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
								Calculate Qualifying Income
								<span className="text-orange-500"> with Confidence</span>
							</h1>

							<p className="text-base lg:text-lg text-gray-600 mb-8 max-w-lg">
								From self-employed borrowers to multi-year tax returns, AI analyzes every scenario
								and delivers accurate income calculations you can trust.
							</p>

							<div className="flex flex-col sm:flex-row gap-4">
								<Link
									to="/app"
									className="inline-flex items-center justify-center gap-2 bg-cta text-white px-6 py-3 rounded-lg font-semibold hover:bg-cta-hover transition-colors shadow-lg hover:shadow-xl"
								>
									Start Income Verification
									<ArrowRight className="w-5 h-5" />
								</Link>
							</div>

							<div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-600">
								<span className="flex items-center gap-1">
									<CheckCircle2 className="w-4 h-4 text-green-500" />
									AI-powered analysis
								</span>
								<span className="flex items-center gap-1">
									<CheckCircle2 className="w-4 h-4 text-green-500" />
									Complex scenarios handled
								</span>
								<span className="flex items-center gap-1">
									<CheckCircle2 className="w-4 h-4 text-green-500" />
									Save hours per loan
								</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			<div className="bg-white border-b border-gray-100 py-5">
				<div className="flex items-center justify-center gap-10">
					<div className="flex flex-col items-center gap-1">
						<img src={soc2Badge} alt="AICPA SOC 2" className="h-12 w-12 object-contain" />
						<span className="text-[10px] font-medium text-gray-400 tracking-wide uppercase">
							SOC2 In Progress
						</span>
					</div>
					<div className="w-px h-10 bg-gray-200" />
					<div className="flex flex-col items-center gap-1">
						<Shield className="h-10 w-10 text-blue-600" />
						<span className="text-[10px] font-semibold text-gray-500 tracking-wide uppercase">
							Zero Data Retention
						</span>
					</div>
				</div>
			</div>

			{/* Features Section */}
			<section className="bg-white py-20">
				<div className="container mx-auto px-4">
					<div className="max-w-5xl mx-auto">
						<div className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								How Fenero Speeds Up Income Verification
							</h2>
							<p className="text-lg text-gray-600">
								Let AI handle the complexity while you focus on closing loans faster
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-8">
							{features.map((feature, index) => (
								<div
									key={index}
									className="bg-gray-50 rounded-xl p-8 border border-gray-200 hover:shadow-lg hover:bg-white transition-all"
								>
									<div className="w-16 h-16 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 mb-4">
										{feature.icon}
									</div>
									<h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
									<p className="text-gray-600">{feature.description}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* Benefits Section - Clean Orange */}
			<section className="py-20 bg-orange-500">
				<div className="container mx-auto px-4">
					<div className="max-w-5xl mx-auto">
						<div className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
								Built for Busy Loan Officers
							</h2>
							<p className="text-lg text-orange-100">
								Spend less time on documents, more time with home buyers
							</p>
						</div>

						<div className="grid md:grid-cols-2 gap-x-12 gap-y-6 text-white">
							{benefits.map((benefit, index) => (
								<div key={index} className="flex items-start gap-3">
									<CheckCircle2 className="w-6 h-6 text-orange-200 flex-shrink-0 mt-0.5" />
									<span className="text-lg">{benefit}</span>
								</div>
							))}
						</div>

						<div className="text-center mt-12">
							<Link
								to="/app"
								className="inline-flex items-center gap-2 bg-white text-cta px-8 py-4 rounded-lg font-semibold text-lg hover:bg-orange-50 transition-colors"
							>
								Try Income Verification Free
								<ArrowRight className="w-5 h-5" />
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="bg-gray-50 py-20">
				<div className="container mx-auto px-4">
					<div className="max-w-3xl mx-auto text-center">
						<div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
							<div className="flex items-center justify-center gap-3 mb-6">
								<div className="w-16 h-16 flex items-center justify-center">
									<img
										src={feneroLogo}
										alt="Fenero logo"
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-3xl font-bold text-gray-900">Fenero</span>
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								Save Hours on Every Loan
							</h2>
							<p className="text-lg text-gray-600 mb-8">
								Let AI handle the document review and complex calculations. Focus on what matters -
								your clients.
							</p>
							<Link
								to="/app"
								className="inline-flex items-center gap-2 bg-cta text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-cta-hover transition-colors"
							>
								Upload Income Documents
								<ArrowRight className="w-5 h-5" />
							</Link>
							<p className="mt-6 text-sm text-gray-500">
								No credit card required • Try income verification free
							</p>
						</div>
					</div>
				</div>
			</section>
		</Shell>
	);
}

export default LandingPage;
