require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'unlock-detector'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = {}
  s.author         = {}
  s.homepage       = ''
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
