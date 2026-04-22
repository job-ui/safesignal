require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name           = 'location-monitor'
  s.version        = package['version']
  s.summary        = 'Native iOS location monitoring for SafeSignal'
  s.description    = 'Provides startMonitoringSignificantLocationChanges and startMonitoringVisits for SafeSignal background heartbeat'
  s.authors        = { 'SafeSignal' => 'job@stoplar.com' }
  s.homepage       = 'https://github.com/job-ui/safesignal'
  s.license        = { :type => 'MIT' }
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source         = { :git => '' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
